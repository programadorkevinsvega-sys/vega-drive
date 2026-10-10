import { afterEach, describe, expect, it, vi } from "vitest";
import { app } from "../src/bff/app.js";
import type { Env } from "../src/worker/env.js";
import { sha256Hex } from "../src/modules/identity/application/sessions/session-tokens.js";

afterEach(() => vi.unstubAllGlobals());

describe("identity logout HTTP integration", () => {
  it("revokes the server session and expires the secure cookie", async () => {
    const token = "a".repeat(43);
    const tokenHash = await sha256Hex(token);
    const calls: Array<{ sql: string; bindings: unknown[] }> = [];
    const db = {
      prepare(sql: string) {
        let bindings: unknown[] = [];
        return {
          bind(...values: unknown[]) {
            bindings = values;
            return this;
          },
          async first<T>() {
            calls.push({ sql, bindings: [...bindings] });
            if (sql.includes("FROM identity_sessions")) {
              return {
                id: "session-a",
                userId: "user-a",
                tokenHash,
                createdAt: "2026-10-10T12:00:00.000Z",
                lastSeenAt: "2026-10-10T12:00:00.000Z",
                expiresAt: "2026-10-17T12:00:00.000Z",
                revokedAt: null,
              } as T;
            }
            return null;
          },
          async run() {
            calls.push({ sql, bindings: [...bindings] });
            return { success: true, meta: { changes: 1 } };
          },
        };
      },
    };
    const env = {
      ASSETS: { fetch: async () => new Response("asset") },
      VEGA_DRIVE_DB: db,
      FILES_BUCKET: {},
      TURNSTILE_SECRET_KEY: "",
      TURNSTILE_SITE_KEY: "",
      MAX_USERS: "10",
    } as unknown as Env;
    const response = await app.fetch(
      new Request("https://vega-drive.test/api/auth/logout", {
        method: "POST",
        headers: {
          Origin: "https://vega-drive.test",
          Cookie: "__Host-session=" + token,
        },
      }),
      env,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    const cookie = response.headers.get("Set-Cookie") ?? "";
    expect(cookie).toContain("__Host-session=;");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Max-Age=0");
    expect(cookie).not.toContain("Domain=");
    const revoke = calls.find((call) =>
      call.sql.startsWith("UPDATE identity_sessions SET revoked_at"),
    );
    expect(revoke?.bindings).toEqual([
      expect.any(String),
      "session-a",
      "user-a",
    ]);
    expect(
      calls.find((call) => call.sql.includes("FROM identity_sessions"))
        ?.bindings,
    ).toEqual([tokenHash]);
  });
});
