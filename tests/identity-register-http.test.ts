import { afterEach, describe, expect, it, vi } from "vitest";
import { app } from "../src/bff/app.js";
import type { Env } from "../src/worker/env.js";

afterEach(() => vi.unstubAllGlobals());

describe("identity registration HTTP integration", () => {
  it("registers through the public gateway and persists a hash instead of a password", async () => {
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
            return null as T | null;
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
              action: "register",
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
    const password = "A strong passphrase 42!";
    const response = await app.fetch(
      new Request("https://vega-drive.test/api/auth/register", {
        method: "POST",
        headers: {
          Origin: "https://vega-drive.test",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: " PERSON@EXAMPLE.TEST ",
          password,
          turnstileToken: "valid-captcha-token",
        }),
      }),
      env,
    );

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ ok: true });
    const insert = calls.find((call) =>
      call.sql.includes("INSERT INTO identity_users"),
    );
    expect(insert?.sql).toContain(
      "WHERE (SELECT COUNT(*) FROM identity_users) < ?",
    );
    expect(insert?.bindings).toHaveLength(8);
    expect(insert?.bindings).not.toContain(password);
    expect(String(insert?.bindings[2])).not.toBe(password);
    expect(insert?.bindings[7]).toBe(10);
  });
});
