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
  const dbFixture = createSqliteD1();
  for (const path of [
    "src/modules/identity/infrastructure/persistence/d1/migrations/0001_identity_initial.sql",
    "src/modules/identity/infrastructure/persistence/d1/migrations/0002_identity_auth_attempts.sql",
    "src/modules/files/infrastructure/persistence/d1/migrations/0001_files_initial.sql",
    "src/modules/files/infrastructure/persistence/d1/migrations/0002_files_catalog_names.sql",
    "src/modules/files/infrastructure/persistence/d1/migrations/0003_files_transfers.sql",
    "src/modules/files/infrastructure/persistence/d1/migrations/0004_files_multipart_uploads.sql",
    "src/modules/files/infrastructure/persistence/d1/migrations/0005_files_recent_activity.sql",
    "src/modules/files/infrastructure/persistence/d1/migrations/0006_files_favorites.sql",
    "src/modules/files/infrastructure/persistence/d1/migrations/0007_files_search_indexes.sql",
    "src/modules/sharing/infrastructure/persistence/d1/migrations/0001_sharing_initial.sql",
  ])
    dbFixture.exec(await readFile(resolve(path), "utf8"));

  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 3600000).toISOString();
  for (const [userId, token] of [
    ["owner-a", tokenA],
    ["owner-b", tokenB],
  ] as const) {
    await dbFixture.db
      .prepare(
        "INSERT INTO identity_users (id, email, password_hash, password_salt, created_at, updated_at, disabled_at) VALUES (?, ?, ?, ?, ?, ?, NULL)",
      )
      .bind(
        userId,
        userId + "@example.test",
        "test-hash",
        "test-salt",
        now,
        now,
      )
      .run();
    await dbFixture.db
      .prepare(
        "INSERT INTO identity_sessions (id, user_id, token_hash, created_at, last_seen_at, expires_at, revoked_at) VALUES (?, ?, ?, ?, ?, ?, NULL)",
      )
      .bind(
        "session-" + userId,
        userId,
        await sha256Hex(token),
        now,
        now,
        expiresAt,
      )
      .run();
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
  return { ...dbFixture, env };
}
let fixture: Awaited<ReturnType<typeof createFixture>>;
async function send(
  path: string,
  init: RequestInit = {},
  token: string | null = tokenA,
) {
  const headers = new Headers(init.headers);
  if (token === null) headers.delete("Cookie");
  else headers.set("Cookie", "__Host-session=" + token);
  const method = (init.method ?? "GET").toUpperCase();
  if (!["GET", "HEAD", "OPTIONS"].includes(method) && !headers.has("Origin"))
    headers.set("Origin", ORIGIN);
  if (typeof init.body === "string" && !headers.has("Content-Type"))
    headers.set("Content-Type", "application/json");
  return app.fetch(
    new Request(new URL(path, ORIGIN), { ...init, headers }),
    fixture.env,
  );
}
async function sendJson(
  path: string,
  method: string,
  body: unknown,
  token: string | null = tokenA,
) {
  return send(
    path,
    {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    token,
  );
}
async function uploadFile() {
  return send("/api/files", {
    method: "POST",
    headers: {
      "Content-Type": "text/plain",
      "X-File-Name": "shared-private.txt",
      "X-File-Size": "15",
    },
    body: "shared-content!",
  });
}
async function json<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}
beforeEach(async () => {
  fixture = await createFixture();
});
afterEach(() => fixture.close());

describe("sharing HTTP routes", () => {
  it("shares one owned file publicly, supports ranges, and revokes only for its owner", async () => {
    const uploaded = await uploadFile();
    expect(uploaded.status).toBe(201);
    const file = await json<{ id: string }>(uploaded);
    const created = await sendJson("/api/shares", "POST", {
      itemId: file.id,
      expiresInSeconds: 3600,
    });
    expect(created.status).toBe(201);
    const share = await json<{ id: string; token: string; permission: string }>(
      created,
    );
    expect(share.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(share.permission).toBe("read");

    const stored = await fixture.db
      .prepare("SELECT token_hash AS tokenHash FROM sharing_links WHERE id = ?")
      .bind(share.id)
      .first<{ tokenHash: string }>();
    expect(stored?.tokenHash).toBe(await sha256Hex(share.token));
    expect(stored?.tokenHash).not.toBe(share.token);

    expect((await send("/api/shares")).status).toBe(200);
    expect((await send("/api/shares", {}, null)).status).toBe(401);
    const access = await sendJson(
      "/api/shares/access",
      "POST",
      { token: share.token },
      null,
    );
    expect(access.status).toBe(200);
    expect(access.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(access.headers.get("Cache-Control")).toContain("no-store");
    expect(await access.text()).toBe("shared-content!");

    const range = await send(
      "/api/shares/access",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Range: "bytes=0-5" },
        body: JSON.stringify({ token: share.token }),
      },
      null,
    );
    expect(range.status).toBe(206);
    expect(range.headers.get("Content-Range")).toBe("bytes 0-5/15");
    expect(await range.text()).toBe("shared");

    const foreignRevoke = await send(
      "/api/shares/" + share.id,
      { method: "DELETE" },
      tokenB,
    );
    expect(foreignRevoke.status).toBe(404);
    const revoked = await send("/api/shares/" + share.id, { method: "DELETE" });
    expect(revoked.status).toBe(200);
    const afterRevoke = await sendJson(
      "/api/shares/access",
      "POST",
      { token: share.token },
      null,
    );
    expect(afterRevoke.status).toBe(404);
  });

  it("requires the optional password and expires links at the server", async () => {
    const uploaded = await uploadFile();
    const file = await json<{ id: string }>(uploaded);
    const created = await sendJson("/api/shares", "POST", {
      itemId: file.id,
      expiresInSeconds: 3600,
      password: "strong-password",
    });
    expect(created.status).toBe(201);
    const share = await json<{
      id: string;
      token: string;
      passwordProtected: boolean;
    }>(created);
    expect(share.passwordProtected).toBe(true);

    const missingPassword = await sendJson(
      "/api/shares/access",
      "POST",
      { token: share.token },
      null,
    );
    expect(missingPassword.status).toBe(401);
    const wrongPassword = await sendJson(
      "/api/shares/access",
      "POST",
      { token: share.token, password: "incorrect-password" },
      null,
    );
    expect(wrongPassword.status).toBe(401);
    const correctPassword = await sendJson(
      "/api/shares/access",
      "POST",
      { token: share.token, password: "strong-password" },
      null,
    );
    expect(correctPassword.status).toBe(200);

    await fixture.db
      .prepare("UPDATE sharing_links SET expires_at = ? WHERE id = ?")
      .bind(new Date(Date.now() - 1000).toISOString(), share.id)
      .run();
    const expired = await sendJson(
      "/api/shares/access",
      "POST",
      { token: share.token, password: "strong-password" },
      null,
    );
    expect(expired.status).toBe(404);
  });

  it("rejects invalid origins and unknown request fields", async () => {
    const uploaded = await uploadFile();
    const file = await json<{ id: string }>(uploaded);
    const badOrigin = await send("/api/shares", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://attacker.test",
      },
      body: JSON.stringify({ itemId: file.id, expiresInSeconds: 3600 }),
    });
    expect(badOrigin.status).toBe(403);
    const unknownField = await sendJson("/api/shares", "POST", {
      itemId: file.id,
      ownerId: "owner-b",
    });
    expect(unknownField.status).toBe(400);
  });
});
