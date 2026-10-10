import { describe, expect, it } from "vitest";
import { app } from "../src/bff/app.js";
import type { Env } from "../src/worker/env.js";

const env = {
  ASSETS: { fetch: async () => new Response("asset") },
  VEGA_DRIVE_DB: {},
  FILES_BUCKET: {},
  TURNSTILE_SECRET_KEY: "test-only-not-a-real-secret",
  TURNSTILE_SITE_KEY: "test-site-key",
  MAX_USERS: "10",
} as unknown as Env;

function request(body: string, origin = "https://vega-drive.test") {
  return new Request("https://vega-drive.test/api/auth/register", {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json" },
    body,
  });
}

describe("identity HTTP input hardening", () => {
  it("rejects unknown fields before reaching identity persistence", async () => {
    const response = await app.fetch(
      request(
        JSON.stringify({
          email: "person@example.test",
          password: "A strong passphrase 42!",
          turnstileToken: "token",
          userId: "attacker-controlled",
        }),
      ),
      env,
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid request" });
  });

  it("rejects cross-origin mutation requests", async () => {
    const response = await app.fetch(
      request(
        JSON.stringify({
          email: "person@example.test",
          password: "A strong passphrase 42!",
          turnstileToken: "token",
        }),
        "https://attacker.example",
      ),
      env,
    );
    expect(response.status).toBe(403);
  });

  it("rejects bodies larger than 64 KiB while streaming", async () => {
    const response = await app.fetch(
      request(
        JSON.stringify({
          email: "person@example.test",
          password: "A strong passphrase 42!",
          turnstileToken: "token",
          padding: "x".repeat(70 * 1024),
        }),
      ),
      env,
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid request" });
  });

  it("sets anti-cache and baseline security headers on API responses", async () => {
    const response = await app.fetch(
      new Request("https://vega-drive.test/api/auth/session"),
      env,
    );
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("X-Frame-Options")).toBe("DENY");
    expect(response.headers.get("Content-Security-Policy")).toContain(
      "default-src 'self'",
    );
  });
});
