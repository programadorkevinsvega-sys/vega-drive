import type {
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
}) {
  return async (
    actor: ResolvedIdentitySession,
    current: unknown,
    next: unknown,
  ): Promise<{ ok: true; token: string } | { ok: false }> => {
    if (
      typeof current !== "string" ||
      current.length > 128 ||
      !validatePassword(next)
    ) {
      return { ok: false };
    }
    const user = await deps.users.findById(actor.userId);
    if (
      !user ||
      user.disabledAt ||
      !(await verifyPassword(current, user.passwordHash, user.passwordSalt))
    ) {
      return { ok: false };
    }
    const credentials = await hashPassword(next);
    const timestamp = new Date().toISOString();
    if (
      !(await deps.users.updatePassword(
        user.id,
        credentials.passwordHash,
        credentials.passwordSalt,
        timestamp,
      ))
    ) {
      return { ok: false };
    }
    const created = await createSession(user.id, deps.sessions);
    await deps.sessions.revokeOtherSessions(
      user.id,
      created.session.id,
      timestamp,
    );
    await deps.sessions.revokeForUser(actor.sessionId, user.id, timestamp);
    return { ok: true, token: created.token };
  };
}
