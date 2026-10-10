import { describe, expect, it } from "vitest";
import { app } from "../src/bff/app.js";
import type { Env } from "../src/worker/env.js";

const env = {
  ASSETS: { fetch: async () => new Response("asset") },
  VEGA_DRIVE_DB: {},
  FILES_BUCKET: {},
  TURNSTILE_SECRET_KEY: "test-only-not-a-real-secret",
  TURNSTILE_SITE_KEY: "",
  MAX_USERS: "10",
} as unknown as Env;

describe("identity HTTP boundary", () => {
  it("rejects state changes without a same-origin Origin", async () => {
    const response = await app.fetch(
      new Request("https://vega-drive.test/api/auth/logout", {
        method: "POST",
      }),
      env,
    );
    expect(response.status).toBe(403);
  });

  it("fails closed when Turnstile is not configured", async () => {
    const response = await app.fetch(
      new Request("https://vega-drive.test/api/auth/register", {
        method: "POST",
        headers: {
          Origin: "https://vega-drive.test",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: "person@example.test",
          password: "A secure passphrase 42!",
          turnstileToken: "token",
        }),
      }),
      env,
    );
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: "Authentication is not configured",
    });
  });

  it("does not treat a missing cookie as an authenticated session", async () => {
    const response = await app.fetch(
      new Request("https://vega-drive.test/api/auth/session"),
      env,
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ authenticated: false });
  });

  it("requires a validated session before password changes", async () => {
    const response = await app.fetch(
      new Request("https://vega-drive.test/api/auth/password", {
        method: "POST",
        headers: {
          Origin: "https://vega-drive.test",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          currentPassword: "Old passphrase 42!",
          newPassword: "New passphrase 84!",
        }),
      }),
      env,
    );
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: "Authentication required",
    });
  });

  it("rejects cross-origin password changes before session resolution", async () => {
    const response = await app.fetch(
      new Request("https://vega-drive.test/api/auth/password", {
        method: "POST",
        headers: {
          Origin: "https://attacker.example",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          currentPassword: "Old passphrase 42!",
          newPassword: "New passphrase 84!",
        }),
      }),
      env,
    );
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Invalid request origin" });
  });

  it("protects future authenticated routes at the BFF boundary", async () => {
    const response = await app.fetch(
      new Request("https://vega-drive.test/api/protected/files"),
      env,
    );
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: "Authentication required",
    });
  });
});
