import { describe, expect, it, vi } from "vitest";
import { createLoginUser } from "../src/modules/identity/application/authentication/login-user.js";
import { hashPassword } from "../src/modules/identity/application/registration/password.js";
import type {
  IdentityAuthAttemptRepository,
  IdentityOutboxRepository,
  IdentitySessionRecord,
  IdentitySessionRepository,
  IdentityUserRecord,
  IdentityUserRepository,
} from "../src/modules/identity/application/ports/identity-repositories.js";
import { sha256Hex } from "../src/modules/identity/application/sessions/session-tokens.js";

const timestamp = "2026-10-10T12:00:00.000Z";
const baseUser = {
  id: "user-a",
  email: "person@example.test",
  createdAt: timestamp,
  updatedAt: timestamp,
  disabledAt: null,
};

function makeDeps(
  overrides: {
    user?: IdentityUserRecord | null;
    previousSession?: IdentitySessionRecord | null;
    locked?: boolean;
    captcha?: boolean;
  } = {},
) {
  const attempts: IdentityAuthAttemptRepository = {
    find: vi.fn(async () =>
      overrides.locked
        ? {
            failedAttempts: 10,
            windowStartedAt: Date.parse(timestamp),
            lockedUntil: Date.parse(timestamp) + 60_000,
          }
        : null,
    ),
    recordFailure: vi.fn(async (_key, now) => ({
      failedAttempts: 1,
      windowStartedAt: now,
      lockedUntil: null,
    })),
    clear: vi.fn(async () => undefined),
  };
  const inserted: IdentitySessionRecord[] = [];
  const revoked: Array<{ sessionId: string; userId: string }> = [];
  const sessions: IdentitySessionRepository = {
    findByTokenHash: vi.fn(async (hash) => {
      if (
        overrides.previousSession &&
        hash === overrides.previousSession.tokenHash
      ) {
        return overrides.previousSession;
      }
      return null;
    }),
    insert: vi.fn(async (session) => {
      inserted.push(session);
    }),
    revokeForUser: vi.fn(async (sessionId, userId) => {
      revoked.push({ sessionId, userId });
      return true;
    }),
    revokeOtherSessions: vi.fn(async () => undefined),
    touch: vi.fn(async () => undefined),
  };
  const user = overrides.user === undefined ? null : overrides.user;
  const users: IdentityUserRepository = {
    findById: vi.fn(async () => user),
    findByNormalizedEmail: vi.fn(async () => user),
    insert: vi.fn(async () => undefined),
    insertWithinLimit: vi.fn(async () => true),
    updatePassword: vi.fn(async () => true),
  };
  const outbox: IdentityOutboxRepository = {
    append: vi.fn(async () => undefined),
    listUnpublished: vi.fn(async () => []),
    markPublished: vi.fn(async () => true),
  };
  const login = createLoginUser({
    users,
    sessions,
    attempts,
    outbox,
    turnstile: { verify: vi.fn(async () => overrides.captcha ?? true) },
    now: () => new Date(timestamp),
  });
  return { login, attempts, sessions, users, inserted, revoked, outbox };
}

describe("identity login use case", () => {
  it("issues a random session token while persisting only its SHA-256 hash", async () => {
    const credentials = await hashPassword("A strong passphrase 42!");
    const user = { ...baseUser, ...credentials };
    const deps = makeDeps({ user });
    const result = await deps.login(
      {
        email: " PERSON@EXAMPLE.TEST ",
        password: "A strong passphrase 42!",
        turnstileToken: "valid-captcha",
      },
      "203.0.113.10",
      null,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.email).toBe("person@example.test");
    expect(result.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(deps.inserted).toHaveLength(1);
    expect(deps.inserted[0]?.tokenHash).toBe(await sha256Hex(result.token));
    expect(deps.inserted[0]?.tokenHash).not.toBe(result.token);
    expect(deps.inserted[0]?.expiresAt).toBe("2026-10-17T12:00:00.000Z");
    expect(deps.attempts.clear).toHaveBeenCalled();
  });

  it("uses the same public failure for unknown and incorrect credentials", async () => {
    const unknown = makeDeps();
    const unknownResult = await unknown.login(
      {
        email: "person@example.test",
        password: "Wrong passphrase 42!",
        turnstileToken: "captcha",
      },
      null,
      null,
    );
    const credentials = await hashPassword("A strong passphrase 42!");
    const incorrect = makeDeps({ user: { ...baseUser, ...credentials } });
    const incorrectResult = await incorrect.login(
      {
        email: "person@example.test",
        password: "Wrong passphrase 42!",
        turnstileToken: "captcha",
      },
      null,
      null,
    );

    expect(unknownResult).toEqual({ ok: false, reason: "invalid-credentials" });
    expect(incorrectResult).toEqual({
      ok: false,
      reason: "invalid-credentials",
    });
  });

  it("does not revoke a different user's session when a stale cookie accompanies login", async () => {
    const credentials = await hashPassword("A strong passphrase 42!");
    const previousSession: IdentitySessionRecord = {
      id: "victim-session",
      userId: "user-b",
      tokenHash: await sha256Hex("stale-session-token"),
      createdAt: timestamp,
      lastSeenAt: timestamp,
      expiresAt: "2026-10-17T12:00:00.000Z",
      revokedAt: null,
    };
    const deps = makeDeps({
      user: { ...baseUser, ...credentials },
      previousSession,
    });
    const result = await deps.login(
      {
        email: baseUser.email,
        password: "A strong passphrase 42!",
        turnstileToken: "captcha",
      },
      null,
      "stale-session-token",
    );

    expect(result.ok).toBe(true);
    expect(deps.revoked).toEqual([]);
  });

  it("blocks locked attempts before calling Turnstile or password verification", async () => {
    const deps = makeDeps({ locked: true });
    const result = await deps.login(
      {
        email: baseUser.email,
        password: "Wrong passphrase 42!",
        turnstileToken: "captcha",
      },
      "203.0.113.10",
      null,
    );

    expect(result).toEqual({ ok: false, reason: "rate-limited" });
    expect(deps.users.findByNormalizedEmail).not.toHaveBeenCalled();
  });

  it("fails closed when Turnstile verification fails", async () => {
    const deps = makeDeps({ captcha: false });
    const result = await deps.login(
      {
        email: baseUser.email,
        password: "A strong passphrase 42!",
        turnstileToken: "captcha",
      },
      "203.0.113.10",
      null,
    );

    expect(result).toEqual({ ok: false, reason: "captcha-failed" });
    expect(deps.users.findByNormalizedEmail).not.toHaveBeenCalled();
    expect(deps.attempts.recordFailure).toHaveBeenCalled();
  });
});
