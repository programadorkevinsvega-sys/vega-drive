import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { app } from "../src/bff/app.js";
import type { Env } from "../src/worker/env.js";
import { sha256Hex } from "../src/modules/identity/application/sessions/session-tokens.js";
import { createSqliteD1 } from "./helpers/sqlite-d1.js";
import { createMemoryR2Bucket } from "./helpers/memory-r2-bucket.js";

const ORIGIN = "https://vega-drive.test";
const tokenA = "a".repeat(43);
const tokenB = "b".repeat(43);

async function createFixture() {
  const database = createSqliteD1();
  for (const path of [
    "src/modules/identity/infrastructure/persistence/d1/migrations/0001_identity_initial.sql",
    "src/modules/identity/infrastructure/persistence/d1/migrations/0002_identity_auth_attempts.sql",
    "src/modules/files/infrastructure/persistence/d1/migrations/0001_files_initial.sql",
    "src/modules/files/infrastructure/persistence/d1/migrations/0002_files_catalog_names.sql",
    "src/modules/files/infrastructure/persistence/d1/migrations/0003_files_transfers.sql",
    "src/modules/files/infrastructure/persistence/d1/migrations/0005_files_recent_activity.sql",
    "src/modules/files/infrastructure/persistence/d1/migrations/0006_files_favorites.sql",
    "src/modules/files/infrastructure/persistence/d1/migrations/0007_files_search_indexes.sql",
  ]) database.exec(await readFile(resolve(path), "utf8"));

  const now = new Date().toISOString();
  const expiry = new Date(Date.now() + 60_000).toISOString();
  for (const [id, token] of [["owner-a", tokenA], ["owner-b", tokenB]] as const) {
    await database.db.prepare(
      "INSERT INTO identity_users (id, email, password_hash, password_salt, created_at, updated_at, disabled_at) VALUES (?, ?, ?, ?, ?, ?, NULL)",
    ).bind(id, id + "@example.test", "hash", "salt", now, now).run();
    await database.db.prepare(
      "INSERT INTO identity_sessions (id, user_id, token_hash, created_at, last_seen_at, expires_at, revoked_at) VALUES (?, ?, ?, ?, ?, ?, NULL)",
    ).bind("session-" + id, id, await sha256Hex(token), now, now, expiry).run();
  }

  const env = {
    ASSETS: { fetch: async () => new Response("asset") },
    VEGA_DRIVE_DB: database.db,
    FILES_BUCKET: createMemoryR2Bucket(),
    TURNSTILE_SECRET_KEY: "",
    TURNSTILE_SITE_KEY: "",
    TURNSTILE_HOSTNAMES: "vega-drive.test",
    MAX_USERS: "10",
  } as unknown as Env;
  return { ...database, env };
}

let fixture: Awaited<ReturnType<typeof createFixture>>;

async function send(path: string, init: RequestInit = {}, token: string | null = tokenA) {
  const headers = new Headers(init.headers);
  if (token === null) headers.delete("Cookie");
  else headers.set("Cookie", "__Host-session=" + token);
  const method = (init.method ?? "GET").toUpperCase();
  if (!["GET", "HEAD", "OPTIONS"].includes(method) && !headers.has("Origin"))
    headers.set("Origin", ORIGIN);
  return app.fetch(new Request(new URL(path, ORIGIN), { ...init, headers }), fixture.env);
}

async function uploadPreviewFile() {
  const body = "0123456789abcdef";
  const response = await send("/api/files", {
    method: "POST",
    headers: {
      "Content-Type": "text/plain",
      "X-File-Name": "private-preview.txt",
      "X-File-Size": String(new TextEncoder().encode(body).byteLength),
    },
    body,
  });
  expect(response.status).toBe(201);
  return (await response.json()) as { id: string };
}

beforeEach(async () => { fixture = await createFixture(); });
afterEach(() => fixture.close());

describe("private preview authorization hardening", () => {
  it("rejects a revoked session at both metadata and content boundaries", async () => {
    const file = await uploadPreviewFile();
    const metadata = await send("/api/files/" + file.id + "/preview");
    expect(metadata.status).toBe(200);
    const { url } = await metadata.json() as { url: string };

    await fixture.db.prepare(
      "UPDATE identity_sessions SET revoked_at = ? WHERE id = ?",
    ).bind(new Date().toISOString(), "session-owner-a").run();

    expect((await send("/api/files/" + file.id + "/preview")).status).toBe(401);
    const content = await send(url);
    expect(content.status).toBe(401);
    expect(await content.json()).toEqual({ error: "Authentication required" });
  });

  it("rejects expired sessions before issuing preview metadata", async () => {
    const file = await uploadPreviewFile();
    await fixture.db.prepare(
      "UPDATE identity_sessions SET expires_at = ? WHERE id = ?",
    ).bind(new Date(Date.now() - 1_000).toISOString(), "session-owner-a").run();
    expect((await send("/api/files/" + file.id + "/preview")).status).toBe(401);
  });

  it("supports suffix byte ranges without introducing browser-to-R2 CORS", async () => {
    const file = await uploadPreviewFile();
    const metadata = await send("/api/files/" + file.id + "/preview");
    const { url } = await metadata.json() as { url: string };
    const content = await send(url, { headers: { Range: "bytes=-4" } });
    expect(content.status).toBe(206);
    expect(content.headers.get("Content-Range")).toBe("bytes 12-15/16");
    expect(await content.text()).toBe("cdef");
    expect(content.headers.get("Access-Control-Allow-Origin")).toBeNull();
    expect(url).toBe("/api/files/" + file.id + "/preview/content");
    expect(url).not.toContain("r2.cloudflarestorage.com");
  });

  it("never exposes another owner's preview through metadata or content", async () => {
    const file = await uploadPreviewFile();
    const metadata = await send("/api/files/" + file.id + "/preview", {}, tokenB);
    expect(metadata.status).toBe(404);
    const ownMetadata = await send("/api/files/" + file.id + "/preview");
    const { url } = await ownMetadata.json() as { url: string };
    expect((await send(url, {}, tokenB)).status).toBe(404);
  });
});
