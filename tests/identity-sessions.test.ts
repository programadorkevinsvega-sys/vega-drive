import { describe, expect, it, vi } from "vitest";
import { createSessionResolver } from "../src/modules/identity/application/sessions/resolve-session.js";
import type {
  IdentitySessionRecord,
  IdentitySessionRepository,
  IdentityUserRecord,
  IdentityUserRepository,
} from "../src/modules/identity/application/ports/identity-repositories.js";
import { sha256Hex } from "../src/modules/identity/application/sessions/session-tokens.js";

const now = new Date("2026-10-10T12:00:00.000Z");
const token = "a".repeat(43);
const user: IdentityUserRecord = {
  id: "user-a",
  email: "person@example.test",
  passwordHash: "hash",
  passwordSalt: "salt",
  createdAt: now.toISOString(),
  updatedAt: now.toISOString(),
  disabledAt: null,
};
const session: IdentitySessionRecord = {
  id: "session-a",
  userId: user.id,
  tokenHash: await sha256Hex(token),
  createdAt: now.toISOString(),
  lastSeenAt: new Date(now.getTime() - 60_000).toISOString(),
  expiresAt: new Date(now.getTime() + 60_000).toISOString(),
  revokedAt: null,
};

function setup(
  options: {
    session?: IdentitySessionRecord | null;
    user?: IdentityUserRecord | null;
  } = {},
) {
  const sessions: IdentitySessionRepository = {
    findByTokenHash: vi.fn(async () =>
      options.session === undefined ? session : options.session,
    ),
    insert: vi.fn(async () => undefined),
    revokeForUser: vi.fn(async () => true),
    revokeOtherSessions: vi.fn(async () => undefined),
    touch: vi.fn(async () => undefined),
  };
  const users: IdentityUserRepository = {
    findById: vi.fn(async () =>
      options.user === undefined ? user : options.user,
    ),
    findByNormalizedEmail: vi.fn(async () => null),
    insert: vi.fn(async () => undefined),
    insertWithinLimit: vi.fn(async () => true),
    updatePassword: vi.fn(async () => true),
  };
  const resolve = createSessionResolver({ sessions, users, now: () => now });
  return { resolve, sessions, users };
}

describe("identity session resolution", () => {
  it("resolves a valid token and refreshes last-seen time", async () => {
    const deps = setup();
    await expect(deps.resolve(token)).resolves.toEqual({
      sessionId: "session-a",
      userId: "user-a",
      email: "person@example.test",
    });
    expect(deps.sessions.findByTokenHash).toHaveBeenCalledWith(
      await sha256Hex(token),
    );
    expect(deps.sessions.touch).toHaveBeenCalledWith(
      "session-a",
      now.toISOString(),
    );
  });

  it("rejects malformed tokens without querying persistence", async () => {
    const deps = setup();
    await expect(deps.resolve("bad")).resolves.toBeNull();
    expect(deps.sessions.findByTokenHash).not.toHaveBeenCalled();
  });

  it("revokes expired absolute sessions", async () => {
    const deps = setup({
      session: {
        ...session,
        expiresAt: new Date(now.getTime() - 1).toISOString(),
      },
    });
    await expect(deps.resolve(token)).resolves.toBeNull();
    expect(deps.sessions.revokeForUser).toHaveBeenCalledWith(
      "session-a",
      "user-a",
      now.toISOString(),
    );
  });

  it("revokes sessions idle for 24 hours", async () => {
    const deps = setup({
      session: {
        ...session,
        lastSeenAt: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(),
      },
    });
    await expect(deps.resolve(token)).resolves.toBeNull();
    expect(deps.sessions.revokeForUser).toHaveBeenCalled();
  });

  it("rejects revoked sessions and disabled users", async () => {
    const revoked = setup({
      session: { ...session, revokedAt: now.toISOString() },
    });
    await expect(revoked.resolve(token)).resolves.toBeNull();
    expect(revoked.users.findById).not.toHaveBeenCalled();

    const disabled = setup({
      user: { ...user, disabledAt: now.toISOString() },
    });
    await expect(disabled.resolve(token)).resolves.toBeNull();
    expect(disabled.sessions.revokeForUser).toHaveBeenCalled();
  });
});
