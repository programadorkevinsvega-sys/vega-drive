import { describe, expect, it, vi } from "vitest";
import { createChangePassword } from "../src/modules/identity/application/authentication/change-password.js";
import { hashPassword } from "../src/modules/identity/application/registration/password.js";
import type {
  IdentityOutboxRepository,
  IdentitySessionRepository,
  IdentityUserRecord,
  IdentityUserRepository,
} from "../src/modules/identity/application/ports/identity-repositories.js";
import type { ResolvedIdentitySession } from "../src/modules/identity/application/sessions/resolve-session.js";
import { hashRateKey, sha256Hex } from "../src/modules/identity/application/sessions/session-tokens.js";

const now = new Date("2026-10-10T12:00:00.000Z");
const actor: ResolvedIdentitySession = {
  sessionId: "session-current",
  userId: "user-a",
  email: "person@example.test",
};

describe("identity change-password use case", () => {
  it("changes the hash, rotates the session, revokes old sessions and audits without secrets", async () => {
    const oldCredentials = await hashPassword("Old passphrase 42!");
    let stored: IdentityUserRecord = {
      id: actor.userId,
      email: actor.email,
      ...oldCredentials,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      disabledAt: null,
    };
    const users: IdentityUserRepository = {
      findById: vi.fn(async () => stored),
      findByNormalizedEmail: vi.fn(async () => null),
      insert: vi.fn(async () => undefined),
      insertWithinLimit: vi.fn(async () => true),
      updatePassword: vi.fn(
        async (_id, passwordHash, passwordSalt, updatedAt) => {
          stored = { ...stored, passwordHash, passwordSalt, updatedAt };
          return true;
        },
      ),
    };
    const inserted: Array<{ tokenHash: string; id: string }> = [];
    const revoked: string[] = [];
    const sessions: IdentitySessionRepository = {
      findByTokenHash: vi.fn(async () => null),
      insert: vi.fn(async (session) => {
        inserted.push(session);
      }),
      revokeForUser: vi.fn(async (sessionId) => {
        revoked.push(sessionId);
        return true;
      }),
      revokeOtherSessions: vi.fn(async () => undefined),
      touch: vi.fn(async () => undefined),
    };
    const outbox: IdentityOutboxRepository = {
      append: vi.fn(async () => undefined),
      listUnpublished: vi.fn(async () => []),
      markPublished: vi.fn(async () => true),
    };
    const changePassword = createChangePassword({
      users,
      sessions,
      outbox,
      now: () => now,
    });

    const result = await changePassword(
      actor,
      "Old passphrase 42!",
      "New passphrase 84!",
      "203.0.113.10",
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(stored.passwordHash).not.toBe(oldCredentials.passwordHash);
    expect(stored.passwordSalt).not.toBe(oldCredentials.passwordSalt);
    expect(inserted).toHaveLength(1);
    expect(inserted[0]?.tokenHash).toBe(await sha256Hex(result.token));
    expect(sessions.revokeOtherSessions).toHaveBeenCalledWith(
      actor.userId,
      inserted[0]?.id,
      now.toISOString(),
    );
    expect(revoked).toContain(actor.sessionId);
    expect(outbox.append).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "identity.password.changed",
        payloadJson: JSON.stringify({
          userId: actor.userId,
          ipHash: await hashRateKey("audit-ip:203.0.113.10"),
        }),
      }),
    );
    expect(JSON.stringify(outbox.append.mock.calls)).not.toContain(
      "Old passphrase",
    );
    expect(JSON.stringify(outbox.append.mock.calls)).not.toContain(
      "New passphrase",
    );
  });

  it("rejects an incorrect current password and audits the failed attempt", async () => {
    const credentials = await hashPassword("Old passphrase 42!");
    const user: IdentityUserRecord = {
      id: actor.userId,
      email: actor.email,
      ...credentials,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      disabledAt: null,
    };
    const users: IdentityUserRepository = {
      findById: vi.fn(async () => user),
      findByNormalizedEmail: vi.fn(async () => null),
      insert: vi.fn(async () => undefined),
      insertWithinLimit: vi.fn(async () => true),
      updatePassword: vi.fn(async () => true),
    };
    const sessions: IdentitySessionRepository = {
      findByTokenHash: vi.fn(async () => null),
      insert: vi.fn(async () => undefined),
      revokeForUser: vi.fn(async () => true),
      revokeOtherSessions: vi.fn(async () => undefined),
      touch: vi.fn(async () => undefined),
    };
    const outbox: IdentityOutboxRepository = {
      append: vi.fn(async () => undefined),
      listUnpublished: vi.fn(async () => []),
      markPublished: vi.fn(async () => true),
    };
    const changePassword = createChangePassword({
      users,
      sessions,
      outbox,
      now: () => now,
    });

    await expect(
      changePassword(
        actor,
        "Wrong current password!",
        "New passphrase 84!",
        null,
      ),
    ).resolves.toEqual({ ok: false });
    expect(sessions.insert).not.toHaveBeenCalled();
    expect(outbox.append).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "identity.password.change.failed",
      }),
    );
  });
});
