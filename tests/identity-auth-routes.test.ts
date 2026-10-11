import { describe, expect, it } from "vitest";
import { app } from "../src/bff/app.js";
import type { Env } from "../src/worker/env.js";
import { sha256Hex } from "../src/modules/identity/application/sessions/session-tokens.js";

const env = {
  ASSETS: { fetch: async () => new Response("asset") },
  VEGA_DRIVE_DB: {},
  FILES_BUCKET: {},
  TURNSTILE_SECRET_KEY: "test-only-not-a-real-secret",
  TURNSTILE_SITE_KEY: "",
  TURNSTILE_HOSTNAMES: "vega-drive.test",
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

  it("exposes only the public Turnstile site key and readiness, never the secret", async () => {
    const configuredEnv = {
      ...env,
      TURNSTILE_SECRET_KEY: "server-only-test-secret",
      TURNSTILE_SITE_KEY: "public-site-key",
    } as Env;
    const response = await app.fetch(
      new Request("https://vega-drive.test/api/auth/config"),
      configuredEnv,
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({
      turnstileSiteKey: "public-site-key",
      ready: true,
    });
    expect(JSON.stringify(body)).not.toContain("server-only-test-secret");
  });

  it("rejects unknown password fields even with a valid server-resolved session", async () => {
    const token = "a".repeat(43);
    const timestamp = new Date().toISOString();
    const user = {
      id: "user-a",
      email: "person@example.test",
      passwordHash: "unused",
      passwordSalt: "unused",
      createdAt: timestamp,
      updatedAt: timestamp,
      disabledAt: null,
    };
    const session = {
      id: "session-a",
      userId: user.id,
      tokenHash: await sha256Hex(token),
      createdAt: timestamp,
      lastSeenAt: timestamp,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      revokedAt: null,
    };
    const db = {
      prepare(sql: string) {
        return {
          bind() {
            return this;
          },
          async first<T>() {
            if (sql.includes("FROM identity_sessions WHERE token_hash = ?")) {
              return session as T;
            }
            if (sql.includes("FROM identity_users WHERE id = ?")) {
              return user as T;
            }
            return null as T | null;
          },
          async run() {
            return { success: true, meta: { changes: 1 } };
          },
        };
      },
    };
    const configuredEnv = {
      ...env,
      VEGA_DRIVE_DB: db,
      TURNSTILE_SECRET_KEY: "test-only-secret",
      TURNSTILE_SITE_KEY: "public-site-key",
    } as unknown as Env;
    const response = await app.fetch(
      new Request("https://vega-drive.test/api/auth/password", {
        method: "POST",
        headers: {
          Origin: "https://vega-drive.test",
          Cookie: "__Host-session=" + token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          currentPassword: "Old passphrase 42!",
          newPassword: "New passphrase 84!",
          ownerId: "user-b",
        }),
      }),
      configuredEnv,
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid request" });
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
