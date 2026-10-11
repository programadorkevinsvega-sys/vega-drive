import { afterEach, describe, expect, it, vi } from "vitest";
import { app } from "../src/bff/app.js";
import type { Env } from "../src/worker/env.js";
import { hashPassword } from "../src/modules/identity/application/registration/password.js";

afterEach(() => vi.unstubAllGlobals());

describe("identity login HTTP integration", () => {
  it("sets the secure host-only cookie and persists only the session hash", async () => {
    const credentials = await hashPassword("A strong passphrase 42!");
    const user = {
      id: "user-a",
      email: "person@example.test",
      ...credentials,
      createdAt: "2026-10-10T12:00:00.000Z",
      updatedAt: "2026-10-10T12:00:00.000Z",
      disabledAt: null,
    };
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
            if (sql.includes("FROM identity_users WHERE email = ?"))
              return user as T;
            return null;
          },
          async run() {
            calls.push({ sql, bindings: [...bindings] });
            return { success: true, meta: { changes: 1 } };
          },
        };
      },
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
          JSON.stringify({
            success: true,
            action: "login",
            hostname: "vega-drive.test",
          }),
          { status: 200 },
        ),
      ),
    );
    const env = {
      ASSETS: { fetch: async () => new Response("asset") },
      VEGA_DRIVE_DB: db,
      FILES_BUCKET: {},
      TURNSTILE_SECRET_KEY: "test-secret",
      TURNSTILE_SITE_KEY: "test-site-key",
      TURNSTILE_HOSTNAMES: "vega-drive.test",
      MAX_USERS: "10",
    } as unknown as Env;

    const response = await app.fetch(
      new Request("https://vega-drive.test/api/auth/login", {
        method: "POST",
        headers: {
          Origin: "https://vega-drive.test",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: " PERSON@EXAMPLE.TEST ",
          password: "A strong passphrase 42!",
          turnstileToken: "valid-captcha-token",
        }),
      }),
      env,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      user: { email: "person@example.test" },
    });
    const cookie = response.headers.get("Set-Cookie") ?? "";
    expect(cookie).toContain("__Host-session=");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Path=/");
    expect(cookie).toContain("Max-Age=604800");
    expect(cookie).not.toContain("Domain=");
    const sessionInsert = calls.find((call) =>
      call.sql.includes("INSERT INTO identity_sessions"),
    );
    expect(sessionInsert).toBeDefined();
    expect(sessionInsert?.bindings).toHaveLength(7);
    expect(sessionInsert?.bindings).not.toContain(
      cookie.split("=")[1]?.split(";")[0],
    );
    expect(String(sessionInsert?.bindings[2])).toMatch(/^[a-f0-9]{64}$/);
  });
});
