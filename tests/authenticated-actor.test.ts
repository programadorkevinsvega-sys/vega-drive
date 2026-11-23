import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import {
  requireAuthenticatedActor,
  type AuthenticatedEnv,
} from "../src/bff/authentication-middleware.js";
import type { Env } from "../src/worker/env.js";
import { sha256Hex } from "../src/modules/identity/application/sessions/session-tokens.js";

const token = "a".repeat(43);
const tokenHash = await sha256Hex(token);
const now = new Date();

function envWithSession(
  options: {
    revokedAt?: string | null;
    expiresAt?: string;
    lastSeenAt?: string;
    touchChanges?: number;
  } = {},
) {
  const session = {
    id: "session-a",
    userId: "user-a",
    tokenHash,
    createdAt: now.toISOString(),
    lastSeenAt: options.lastSeenAt ?? now.toISOString(),
    expiresAt:
      options.expiresAt ??
      new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
    revokedAt: options.revokedAt ?? null,
  };
  const user = {
    id: "user-a",
    email: "person@example.test",
    passwordHash: "hash",
    passwordSalt: "salt",
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    disabledAt: null,
  };
  const db = {
    prepare(sql: string) {
      let bindings: unknown[] = [];
      return {
        bind(...values: unknown[]) {
          bindings = values;
          return this;
        },
        async first<T>() {
          if (sql.includes("FROM identity_sessions")) {
            return bindings[0] === tokenHash ? (session as T) : null;
          }
          if (sql.includes("FROM identity_users")) return user as T;
          return null;
        },
        async run() {
          const changes = sql.includes("SET last_seen_at")
            ? (options.touchChanges ?? 1)
            : 1;
          return { success: true, meta: { changes } };
        },
      };
    },
  };
  return {
    ASSETS: { fetch: async () => new Response("asset") },
    VEGA_DRIVE_DB: db,
    FILES_BUCKET: {},
    TURNSTILE_SECRET_KEY: "",
    TURNSTILE_SITE_KEY: "",
    MAX_USERS: "10",
  } as unknown as Env;
}

describe("AuthenticatedActor middleware", () => {
  it("builds actor identity exclusively from the server-resolved session", async () => {
    const env = envWithSession();
    const app = new Hono<AuthenticatedEnv>();
    app.get("/protected", requireAuthenticatedActor, (c) =>
      c.json(c.get("actor")),
    );
    const response = await app.fetch(
      new Request("https://vega-drive.test/protected", {
        headers: { Cookie: "__Host-session=" + token },
      }),
      env,
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      userId: "user-a",
      sessionId: "session-a",
      email: "person@example.test",
    });
  });

  it("rejects expired sessions before setting an actor", async () => {
    const env = envWithSession({
      expiresAt: new Date(now.getTime() - 1).toISOString(),
    });
    const app = new Hono<AuthenticatedEnv>();
    app.get("/protected", requireAuthenticatedActor, (c) =>
      c.json(c.get("actor")),
    );
    const response = await app.fetch(
      new Request("https://vega-drive.test/protected", {
        headers: { Cookie: "__Host-session=" + token },
      }),
      env,
    );
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Authentication required" });
  });
  it("rejects a session revoked or invalidated between lookup and atomic refresh", async () => {
    const env = envWithSession({ touchChanges: 0 });
    const app = new Hono<AuthenticatedEnv>();
    app.get("/protected", requireAuthenticatedActor, (c) =>
      c.json(c.get("actor")),
    );
    const response = await app.fetch(
      new Request("https://vega-drive.test/protected", {
        headers: { Cookie: "__Host-session=" + token },
      }),
      env,
    );
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: "Authentication required",
    });
  });

});
