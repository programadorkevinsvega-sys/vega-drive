import { describe, expect, it } from "vitest";
import { app } from "../src/bff/app.js";
import type { Env } from "../src/worker/env.js";
const env = { ASSETS: { fetch: async () => new Response("asset") }, VEGA_DRIVE_DB: {}, FILES_BUCKET: {}, TURNSTILE_SECRET_KEY: "test-only-not-a-real-secret", TURNSTILE_SITE_KEY: "", MAX_USERS: "10" } as unknown as Env;
describe("GET /api/health", () => {
  it("returns minimal liveness response and security headers", async () => {
    const response = await app.fetch(new Request("https://vega-drive.test/api/health"), env);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok", service: "vega-drive" });
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("content-security-policy")).toContain("default-src 'self'");
  });
  it("hides implementation details for unknown API routes", async () => {
    const response = await app.fetch(new Request("https://vega-drive.test/api/private"), env);
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Not found" });
  });
});
