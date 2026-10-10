import type {
  IdentityOutboxRepository,
  IdentitySessionRepository,
  IdentityUserRepository,
} from "../ports/identity-repositories.js";
import {
  hashPassword,
  validatePassword,
  verifyPassword,
} from "../registration/password.js";
import { createSession } from "../sessions/session-tokens.js";
import type { ResolvedIdentitySession } from "../sessions/resolve-session.js";

export function createChangePassword(deps: {
  users: IdentityUserRepository;
  sessions: IdentitySessionRepository;
  outbox: IdentityOutboxRepository;
  now?: () => Date;
}) {
  const now = deps.now ?? (() => new Date());
  async function audit(eventType: string, userId: string, ip: string | null) {
    try {
      await deps.outbox.append({
        id: crypto.randomUUID(),
        eventType,
        payloadJson: JSON.stringify({ userId, ip }),
        createdAt: now().toISOString(),
        publishedAt: null,
      });
    } catch {
      // Audit failures must not expose credentials or block password changes.
    }
  }

  return async (
    actor: ResolvedIdentitySession,
    current: unknown,
    next: unknown,
    ip: string | null,
  ): Promise<{ ok: true; token: string } | { ok: false }> => {
    if (
      typeof current !== "string" ||
      current.length > 128 ||
      !validatePassword(next)
    ) {
      await audit("identity.password.change.failed", actor.userId, ip);
      return { ok: false };
    }
    const user = await deps.users.findById(actor.userId);
    if (
      !user ||
      user.disabledAt ||
      !(await verifyPassword(current, user.passwordHash, user.passwordSalt))
    ) {
      await audit("identity.password.change.failed", actor.userId, ip);
      return { ok: false };
    }
    const credentials = await hashPassword(next);
    const timestamp = now().toISOString();
    if (
      !(await deps.users.updatePassword(
        user.id,
        credentials.passwordHash,
        credentials.passwordSalt,
        timestamp,
      ))
    ) {
      await audit("identity.password.change.failed", actor.userId, ip);
      return { ok: false };
    }
    const created = await createSession(user.id, deps.sessions, now());
    await deps.sessions.revokeOtherSessions(
      user.id,
      created.session.id,
      timestamp,
    );
    await deps.sessions.revokeForUser(actor.sessionId, user.id, timestamp);
    await audit("identity.password.changed", user.id, ip);
    return { ok: true, token: created.token };
  };
}
