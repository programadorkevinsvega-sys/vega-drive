import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { app } from "../src/bff/app.js";
import type { Env } from "../src/worker/env.js";
import { createCompositionRoot } from "../src/worker/composition-root.js";
import { sha256Hex } from "../src/modules/identity/application/sessions/session-tokens.js";
import { createSqliteD1 } from "./helpers/sqlite-d1.js";
import { createMemoryR2Bucket } from "./helpers/memory-r2-bucket.js";

const ORIGIN = "https://vega-drive.test";
const tokenA = "a".repeat(43);
const tokenB = "b".repeat(43);

async function runSql(
  db: D1Database,
  sql: string,
  bindings: unknown[],
): Promise<void> {
  await db
    .prepare(sql)
    .bind(...bindings)
    .run();
}

async function createHttpFixture() {
  const dbFixture = createSqliteD1();
  for (const path of [
    "src/modules/identity/infrastructure/persistence/d1/migrations/0001_identity_initial.sql",
    "src/modules/identity/infrastructure/persistence/d1/migrations/0002_identity_auth_attempts.sql",
    "src/modules/files/infrastructure/persistence/d1/migrations/0001_files_initial.sql",
    "src/modules/files/infrastructure/persistence/d1/migrations/0002_files_catalog_names.sql",
    "src/modules/files/infrastructure/persistence/d1/migrations/0003_files_transfers.sql",
  ]) {
    dbFixture.exec(await readFile(resolve(path), "utf8"));
  }

  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  for (const [userId, token] of [
    ["owner-a", tokenA],
    ["owner-b", tokenB],
  ] as const) {
    await runSql(
      dbFixture.db,
      "INSERT INTO identity_users (id, email, password_hash, password_salt, created_at, updated_at, disabled_at) VALUES (?, ?, ?, ?, ?, ?, NULL)",
      [userId, userId + "@example.test", "test-hash", "test-salt", now, now],
    );
    await runSql(
      dbFixture.db,
      "INSERT INTO identity_sessions (id, user_id, token_hash, created_at, last_seen_at, expires_at, revoked_at) VALUES (?, ?, ?, ?, ?, ?, NULL)",
      [
        "session-" + userId,
        userId,
        await sha256Hex(token),
        now,
        now,
        expiresAt,
      ],
    );
  }

  const env = {
    ASSETS: { fetch: async () => new Response("asset") },
    VEGA_DRIVE_DB: dbFixture.db,
    FILES_BUCKET: createMemoryR2Bucket(),
    TURNSTILE_SECRET_KEY: "",
    TURNSTILE_SITE_KEY: "",
    TURNSTILE_HOSTNAMES: "vega-drive.test",
    MAX_USERS: "10",
  } as unknown as Env;

  return { ...dbFixture, env, tokenA, tokenB };
}

let fixture: Awaited<ReturnType<typeof createHttpFixture>>;

async function send(
  path: string,
  init: RequestInit = {},
  token: string | null = fixture.tokenA,
  env: Env = fixture.env,
): Promise<Response> {
  const headers = new Headers(init.headers);
  if (token === null) headers.delete("Cookie");
  else headers.set("Cookie", "__Host-session=" + token);

  const method = (init.method ?? "GET").toUpperCase();
  if (!["GET", "HEAD", "OPTIONS"].includes(method) && !headers.has("Origin")) {
    headers.set("Origin", ORIGIN);
  }
  if (typeof init.body === "string" && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  return app.fetch(
    new Request(new URL(path, ORIGIN), { ...init, headers }),
    env,
  );
}

async function sendJson(
  path: string,
  method: string,
  body: unknown,
  token: string | null = fixture.tokenA,
  env: Env = fixture.env,
): Promise<Response> {
  return send(
    path,
    {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    token,
    env,
  );
}

async function sendFile(
  name: string,
  body: string,
  token: string | null = fixture.tokenA,
  folderId?: string,
): Promise<Response> {
  const headers = new Headers({
    "Content-Type": "text/plain",
    "X-File-Name": encodeURIComponent(name),
    "X-File-Size": String(new TextEncoder().encode(body).byteLength),
  });
  if (folderId) headers.set("X-File-Folder-Id", folderId);
  return send("/api/files", { method: "POST", headers, body }, token);
}

async function json<T = Record<string, unknown>>(
  response: Response,
): Promise<T> {
  return (await response.json()) as T;
}

beforeEach(async () => {
  fixture = await createHttpFixture();
});

afterEach(() => fixture.close());

describe("files catalog HTTP routes", () => {
  it("rejects private catalog routes without a valid session", async () => {
    const listing = await send("/api/files", {}, null);
    expect(listing.status).toBe(401);
    expect(await json(listing)).toEqual({ error: "Authentication required" });

    const create = await sendJson(
      "/api/files/folders",
      "POST",
      { name: "Must not exist" },
      null,
    );
    expect(create.status).toBe(401);
  });

  it("lists root and nested folders with server-provided breadcrumbs", async () => {
    const parentResponse = await sendJson("/api/files/folders", "POST", {
      name: "Parent",
    });
    expect(parentResponse.status).toBe(201);
    const parent = await json<{ id: string }>(parentResponse);

    const childResponse = await sendJson("/api/files/folders", "POST", {
      name: "Child",
      parentFolderId: parent.id,
    });
    expect(childResponse.status).toBe(201);
    const child = await json<{ id: string }>(childResponse);

    const root = await send("/api/files");
    expect(root.status).toBe(200);
    expect(await json(root)).toMatchObject({
      folder: null,
      breadcrumbs: [{ id: null, name: "Mi unidad" }],
      folders: [{ id: parent.id, name: "Parent" }],
      files: [],
      nextCursor: null,
    });

    const nested = await send(
      "/api/files?folderId=" + encodeURIComponent(child.id),
    );
    expect(nested.status).toBe(200);
    expect(await json(nested)).toMatchObject({
      folder: { id: child.id, name: "Child" },
      breadcrumbs: [
        { id: null, name: "Mi unidad" },
        { id: parent.id, name: "Parent" },
        { id: child.id, name: "Child" },
      ],
      folders: [],
      files: [],
    });
  });

  it("creates, renames and moves folders and file metadata through HTTP", async () => {
    const destinationResponse = await sendJson("/api/files/folders", "POST", {
      name: "Destination",
    });
    const destination = await json<{ id: string }>(destinationResponse);
    const folderResponse = await sendJson("/api/files/folders", "POST", {
      name: "Before",
    });
    const folder = await json<{ id: string }>(folderResponse);

    const renamedFolder = await sendJson(
      "/api/files/folders/" + folder.id,
      "PATCH",
      { name: "Renamed" },
    );
    expect(renamedFolder.status).toBe(200);
    expect(await json(renamedFolder)).toMatchObject({
      id: folder.id,
      name: "Renamed",
    });

    const movedFolder = await sendJson(
      "/api/files/folders/" + folder.id + "/move",
      "POST",
      { parentFolderId: destination.id },
    );
    expect(movedFolder.status).toBe(200);
    expect(await json(movedFolder)).toMatchObject({
      id: folder.id,
      parentFolderId: destination.id,
    });

    const metadataResponse = await sendFile("before.txt", "hello world!");
    expect(metadataResponse.status).toBe(201);
    const itemPayload = await json<Record<string, unknown>>(metadataResponse);
    expect(itemPayload.name).toBe("before.txt");
    expect(itemPayload).not.toHaveProperty("storageKey");
    const item = itemPayload as { id: string; name: string };

    const renamedItem = await sendJson("/api/files/items/" + item.id, "PATCH", {
      name: "after.txt",
    });
    expect(renamedItem.status).toBe(200);
    expect(await json(renamedItem)).toMatchObject({
      id: item.id,
      name: "after.txt",
    });

    const movedItem = await sendJson(
      "/api/files/items/" + item.id + "/move",
      "POST",
      { folderId: folder.id },
    );
    expect(movedItem.status).toBe(200);
    expect(await json(movedItem)).toMatchObject({
      id: item.id,
      folderId: folder.id,
    });

    const nested = await send(
      "/api/files?folderId=" + encodeURIComponent(folder.id),
    );
    expect(nested.status).toBe(200);
    expect(await json(nested)).toMatchObject({
      breadcrumbs: [
        { id: null, name: "Mi unidad" },
        { id: destination.id, name: "Destination" },
        { id: folder.id, name: "Renamed" },
      ],
      files: [{ id: item.id, name: "after.txt" }],
    });
  });

  it("accepts empty DELETE request streams but rejects non-empty bodies", async () => {
    const folderResponse = await sendJson("/api/files/folders", "POST", {
      name: "Delete body validation folder",
    });
    const folder = await json<{ id: string }>(folderResponse);
    const fileResponse = await sendFile(
      "delete-body-validation.txt",
      "content",
    );
    const file = await json<{ id: string }>(fileResponse);

    const emptyItemDelete = await send("/api/files/items/" + file.id, {
      method: "DELETE",
      body: "",
    });
    expect(emptyItemDelete.status).toBe(200);

    const emptyFolderDelete = await send("/api/files/folders/" + folder.id, {
      method: "DELETE",
      body: "",
    });
    expect(emptyFolderDelete.status).toBe(200);

    const protectedFileResponse = await sendFile(
      "protected-delete.txt",
      "keep",
    );
    const protectedFile = await json<{ id: string }>(protectedFileResponse);
    const nonEmptyDelete = await send("/api/files/items/" + protectedFile.id, {
      method: "DELETE",
      body: "unexpected",
    });
    expect(nonEmptyDelete.status).toBe(400);
    expect(await json(nonEmptyDelete)).toEqual({ error: "Invalid request" });

    const stillExists = await send("/api/files");
    expect(
      await json<{ files: Array<{ id: string }> }>(stillExists),
    ).toMatchObject({
      files: [{ id: protectedFile.id }],
    });
  });

  it("permanently deletes file objects and nested folder contents from R2", async () => {
    const parentResponse = await sendJson("/api/files/folders", "POST", {
      name: "Permanent parent",
    });
    const parent = await json<{ id: string }>(parentResponse);
    const childResponse = await sendJson("/api/files/folders", "POST", {
      name: "Permanent child",
      parentFolderId: parent.id,
    });
    const child = await json<{ id: string }>(childResponse);
    const upload = await sendFile(
      "permanent.txt",
      "stored bytes",
      fixture.tokenA,
      child.id,
    );
    const file = await json<{ id: string }>(upload);
    const stored = await fixture.db
      .prepare("SELECT storage_key AS storageKey FROM files_items WHERE id = ?")
      .bind(file.id)
      .first<{ storageKey: string }>();
    expect(stored).not.toBeNull();
    expect(
      await fixture.env.FILES_BUCKET.head(stored!.storageKey),
    ).not.toBeNull();

    const response = await send(
      "/api/files/folders/" + parent.id + "/permanent-delete",
      { method: "POST" },
    );
    expect(response.status).toBe(200);
    expect(await json(response)).toEqual({ ok: true });
    expect(await fixture.env.FILES_BUCKET.head(stored!.storageKey)).toBeNull();
    expect(
      await fixture.db
        .prepare("SELECT id FROM files_items WHERE id = ?")
        .bind(file.id)
        .first(),
    ).toBeNull();
    expect(
      await fixture.db
        .prepare("SELECT id FROM files_folders WHERE id IN (?, ?)")
        .bind(parent.id, child.id)
        .all(),
    ).toMatchObject({ results: [] });
  });

  it("automatically purges trash older than 30 days from D1 and R2", async () => {
    const upload = await sendFile("expired.txt", "expired bytes");
    const file = await json<{ id: string }>(upload);
    const stored = await fixture.db
      .prepare("SELECT storage_key AS storageKey FROM files_items WHERE id = ?")
      .bind(file.id)
      .first<{ storageKey: string }>();
    expect(stored).not.toBeNull();

    const expiredAt = new Date(
      Date.now() - 31 * 24 * 60 * 60 * 1000,
    ).toISOString();
    await runSql(
      fixture.db,
      "UPDATE files_items SET deleted_at = ?, updated_at = ? WHERE id = ?",
      [expiredAt, expiredAt, file.id],
    );
    const cleaned = await createCompositionRoot(
      fixture.env,
    ).files.cleanupExpiredTrash(new Date().toISOString(), 10);

    expect(cleaned).toBeGreaterThan(0);
    expect(await fixture.env.FILES_BUCKET.head(stored!.storageKey)).toBeNull();
    expect(
      await fixture.db
        .prepare("SELECT id FROM files_items WHERE id = ?")
        .bind(file.id)
        .first(),
    ).toBeNull();
  });

  it("empties only the authenticated owner's trash, including nested R2 objects", async () => {
    const parentResponse = await sendJson("/api/files/folders", "POST", {
      name: "Trash parent",
    });
    const parent = await json<{ id: string }>(parentResponse);
    const childResponse = await sendJson("/api/files/folders", "POST", {
      name: "Trash child",
      parentFolderId: parent.id,
    });
    const child = await json<{ id: string }>(childResponse);
    const nestedUpload = await sendFile(
      "nested-trash.txt",
      "nested bytes",
      fixture.tokenA,
      child.id,
    );
    const nestedFile = await json<{ id: string }>(nestedUpload);
    const standaloneUpload = await sendFile(
      "standalone-trash.txt",
      "trash bytes",
    );
    const standaloneFile = await json<{ id: string }>(standaloneUpload);
    const activeUpload = await sendFile("keep-active.txt", "keep bytes");
    const activeFile = await json<{ id: string }>(activeUpload);
    const foreignUpload = await sendFile(
      "foreign-trash.txt",
      "foreign bytes",
      fixture.tokenB,
    );
    const foreignFile = await json<{ id: string }>(foreignUpload);

    const keys = await Promise.all(
      [nestedFile.id, standaloneFile.id, foreignFile.id].map(async (id) => {
        const record = await fixture.db
          .prepare(
            "SELECT storage_key AS storageKey FROM files_items WHERE id = ?",
          )
          .bind(id)
          .first<{ storageKey: string }>();
        expect(record).not.toBeNull();
        return [id, record!.storageKey] as const;
      }),
    );
    await send("/api/files/folders/" + parent.id, { method: "DELETE" });
    await send("/api/files/items/" + standaloneFile.id, {
      method: "DELETE",
    });
    await send(
      "/api/files/items/" + foreignFile.id,
      { method: "DELETE" },
      fixture.tokenB,
    );

    const response = await send("/api/files/trash/empty", {
      method: "POST",
    });
    expect(response.status).toBe(200);
    expect(await json(response)).toEqual({ ok: true });

    for (const [id, key] of keys.filter(([id]) => id !== foreignFile.id)) {
      expect(await fixture.env.FILES_BUCKET.head(key)).toBeNull();
      expect(
        await fixture.db
          .prepare("SELECT id FROM files_items WHERE id = ?")
          .bind(id)
          .first(),
      ).toBeNull();
    }
    expect(
      await fixture.db
        .prepare("SELECT id FROM files_folders WHERE id IN (?, ?)")
        .bind(parent.id, child.id)
        .all(),
    ).toMatchObject({ results: [] });
    expect(
      await fixture.db
        .prepare("SELECT id FROM files_items WHERE id = ?")
        .bind(activeFile.id)
        .first(),
    ).not.toBeNull();
    expect(
      await fixture.env.FILES_BUCKET.head(
        keys.find(([id]) => id === foreignFile.id)![1],
      ),
    ).not.toBeNull();

    const ownerTrash = await send("/api/files/trash");
    expect(
      (await json<{ nodes: Array<{ id: string }> }>(ownerTrash)).nodes,
    ).toEqual([]);
    const foreignTrash = await send("/api/files/trash", {}, fixture.tokenB);
    expect(
      (await json<{ nodes: Array<{ id: string }> }>(foreignTrash)).nodes.map(
        (node) => node.id,
      ),
    ).toContain(foreignFile.id);
  });

  it("soft-deletes, lists trash and restores folders and items", async () => {
    const folderResponse = await sendJson("/api/files/folders", "POST", {
      name: "Trash folder",
    });
    const folder = await json<{ id: string }>(folderResponse);
    const itemResponse = await sendFile("trash.txt", "");
    const item = await json<{ id: string }>(itemResponse);

    const deleteItem = await send("/api/files/items/" + item.id, {
      method: "DELETE",
    });
    expect(deleteItem.status).toBe(200);
    expect(await json(deleteItem)).toEqual({ ok: true });

    const deleteFolder = await send("/api/files/folders/" + folder.id, {
      method: "DELETE",
    });
    expect(deleteFolder.status).toBe(200);

    const trash = await send("/api/files/trash");
    expect(trash.status).toBe(200);
    const trashedNodes = await json<{
      nodes: Array<{ id: string; type: string; deletedAt: string }>;
    }>(trash);
    expect(trashedNodes.nodes.length).toBeGreaterThanOrEqual(2);
    expect(trashedNodes.nodes.every((node) => node.deletedAt.length > 0)).toBe(
      true,
    );
    expect(trashedNodes.nodes.map((node) => node.id)).toEqual(
      expect.arrayContaining([folder.id, item.id]),
    );

    const restoreFolder = await send(
      "/api/files/trash/folders/" + folder.id + "/restore",
      { method: "POST" },
    );
    expect(restoreFolder.status).toBe(200);
    expect(await json(restoreFolder)).toMatchObject({
      id: folder.id,
      deletedAt: null,
    });

    const restoreItem = await send(
      "/api/files/trash/items/" + item.id + "/restore",
      { method: "POST" },
    );
    expect(restoreItem.status).toBe(200);
    expect(await json(restoreItem)).toMatchObject({
      id: item.id,
      deletedAt: null,
    });
  });

  it("validates query parameters, JSON shape, identifiers, Origin and name conflicts", async () => {
    const unexpectedQuery = await send("/api/files?ownerId=owner-b");
    expect(unexpectedQuery.status).toBe(400);

    const spoofedOwnerBody = await sendJson("/api/files/folders", "POST", {
      name: "Spoofed owner",
      ownerId: "owner-b",
    });
    expect(spoofedOwnerBody.status).toBe(400);

    const spoofedUserBody = await sendJson("/api/files/folders", "POST", {
      name: "Spoofed user",
      userId: "owner-b",
    });
    expect(spoofedUserBody.status).toBe(400);

    const spoofedUserQuery = await send("/api/files?userId=owner-b");
    expect(spoofedUserQuery.status).toBe(400);

    const wrongContentType = await send("/api/files/folders", {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ name: "Wrong type" }),
    });
    expect(wrongContentType.status).toBe(400);

    const invalidCursor = await send("/api/files?cursor=not-a-cursor");
    expect(invalidCursor.status).toBe(400);

    const malformedJson = await send("/api/files/folders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{invalid",
    });
    expect(malformedJson.status).toBe(400);

    const tooLarge = await sendJson("/api/files/folders", "POST", {
      name: "x".repeat(70 * 1024),
    });
    expect(tooLarge.status).toBe(400);

    const crossOrigin = await send("/api/files/folders", {
      method: "POST",
      headers: {
        Origin: "https://attacker.example",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: "Cross origin" }),
    });
    expect(crossOrigin.status).toBe(403);

    const invalidId = await sendJson("/api/files/items/bad!/move", "POST", {
      folderId: null,
    });
    expect(invalidId.status).toBe(400);

    const first = await sendJson("/api/files/folders", "POST", {
      name: "Duplicate",
    });
    expect(first.status).toBe(201);
    const duplicate = await sendJson("/api/files/folders", "POST", {
      name: "Duplicate",
    });
    expect(duplicate.status).toBe(409);
    expect(await json(duplicate)).toEqual({
      error: "A catalog item with that name already exists",
    });

    const missing = await sendJson(
      "/api/files/folders/missing-folder",
      "PATCH",
      { name: "Renamed" },
    );
    expect(missing.status).toBe(404);
    expect(await json(missing)).toEqual({ error: "Catalog item not found" });
  });

  it("prevents cross-owner reads and mutations and isolates the trash", async () => {
    const foreignFolderResponse = await sendJson(
      "/api/files/folders",
      "POST",
      { name: "Foreign folder" },
      fixture.tokenB,
    );
    const foreignFolder = await json<{ id: string }>(foreignFolderResponse);

    const foreignItemResponse = await sendFile(
      "foreign.txt",
      "file",
      fixture.tokenB,
    );
    const foreignItem = await json<{ id: string }>(foreignItemResponse);

    const foreignFolderList = await send(
      "/api/files?folderId=" + encodeURIComponent(foreignFolder.id),
    );
    expect(foreignFolderList.status).toBe(404);

    const renameForeignFolder = await sendJson(
      "/api/files/folders/" + foreignFolder.id,
      "PATCH",
      { name: "Stolen" },
    );
    expect(renameForeignFolder.status).toBe(404);

    const deleteForeignFolder = await send(
      "/api/files/folders/" + foreignFolder.id,
      { method: "DELETE" },
    );
    expect(deleteForeignFolder.status).toBe(404);

    const renameForeignItem = await sendJson(
      "/api/files/items/" + foreignItem.id,
      "PATCH",
      { name: "stolen.txt" },
    );
    expect(renameForeignItem.status).toBe(404);

    const moveForeignItem = await sendJson(
      "/api/files/items/" + foreignItem.id + "/move",
      "POST",
      { folderId: null },
    );
    expect(moveForeignItem.status).toBe(404);

    const deleteItemAsOwner = await send(
      "/api/files/items/" + foreignItem.id,
      { method: "DELETE" },
      fixture.tokenB,
    );
    expect(deleteItemAsOwner.status).toBe(200);
    const deleteFolderAsOwner = await send(
      "/api/files/folders/" + foreignFolder.id,
      { method: "DELETE" },
      fixture.tokenB,
    );
    expect(deleteFolderAsOwner.status).toBe(200);

    const restoreForeignItem = await send(
      "/api/files/trash/items/" + foreignItem.id + "/restore",
      { method: "POST" },
    );
    expect(restoreForeignItem.status).toBe(404);
    const restoreForeignFolder = await send(
      "/api/files/trash/folders/" + foreignFolder.id + "/restore",
      { method: "POST" },
    );
    expect(restoreForeignFolder.status).toBe(404);

    const ownerTrash = await send("/api/files/trash");
    expect(ownerTrash.status).toBe(200);
    const trash = await json<{ nodes: Array<{ id: string }> }>(ownerTrash);
    expect(trash.nodes.map((node) => node.id)).not.toContain(foreignFolder.id);
    expect(trash.nodes.map((node) => node.id)).not.toContain(foreignItem.id);
  });

  it("streams private uploads and downloads with ranges and owner isolation", async () => {
    const upload = await sendFile("private report.txt", "abcdefghijklmnop");
    expect(upload.status).toBe(201);
    const file = await json<{
      id: string;
      name: string;
      sizeBytes: number;
      storageKey?: string;
    }>(upload);
    expect(file).toMatchObject({ name: "private report.txt", sizeBytes: 16 });
    expect(file).not.toHaveProperty("storageKey");

    const download = await send("/api/files/" + file.id + "/download");
    expect(download.status).toBe(200);
    expect(download.headers.get("Content-Disposition")).toContain("attachment");
    expect(download.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(await download.text()).toBe("abcdefghijklmnop");

    const partial = await send("/api/files/" + file.id + "/download", {
      headers: { Range: "bytes=2-5" },
    });
    expect(partial.status).toBe(206);
    expect(partial.headers.get("Content-Range")).toBe("bytes 2-5/16");
    expect(partial.headers.get("Content-Length")).toBe("4");
    expect(await partial.text()).toBe("cdef");

    const invalidRange = await send("/api/files/" + file.id + "/download", {
      headers: { Range: "bytes=99-101" },
    });
    expect(invalidRange.status).toBe(416);
    expect(invalidRange.headers.get("Content-Range")).toBe("bytes */16");

    const foreignDownload = await send(
      "/api/files/" + file.id + "/download",
      {},
      fixture.tokenB,
    );
    expect(foreignDownload.status).toBe(404);
  });

  it("rejects upload bodies whose actual byte count differs from the declaration", async () => {
    const response = await send("/api/files", {
      method: "POST",
      headers: {
        "Content-Type": "text/plain",
        "X-File-Name": "incorrect.txt",
        "X-File-Size": "3",
      },
      body: "longer",
    });
    expect(response.status).toBe(400);
    const root = await send("/api/files");
    expect(await json(root)).toMatchObject({ files: [] });
  });

  it("maps catalog infrastructure failures to safe HTTP 503 responses", async () => {
    const failingDb = {
      prepare(sql: string) {
        if (/FROM files_folders|FROM files_items/.test(sql)) {
          throw new Error("PRIVATE SQL AND INTERNAL DETAILS");
        }
        return fixture.db.prepare(sql);
      },
    } as unknown as D1Database;
    const failingEnv = {
      ...fixture.env,
      VEGA_DRIVE_DB: failingDb,
    } as Env;

    const response = await send("/api/files", {}, fixture.tokenA, failingEnv);
    expect(response.status).toBe(503);
    const responseText = await response.text();
    expect(responseText).toBe(
      JSON.stringify({ error: "Catalog temporarily unavailable" }),
    );
    expect(responseText).not.toContain("PRIVATE SQL");
  });
});
