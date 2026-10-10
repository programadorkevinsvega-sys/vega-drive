import type {
  IdentitySessionRepository,
  IdentityUserRepository,
} from "../ports/identity-repositories.js";
import { sha256Hex } from "./session-tokens.js";

export interface ResolvedIdentitySession {
  sessionId: string;
  userId: string;
  email: string;
}

const IDLE_TIMEOUT_MS = 24 * 60 * 60 * 1000;

export function createSessionResolver(deps: {
  sessions: IdentitySessionRepository;
  users: IdentityUserRepository;
  now?: () => Date;
}) {
  const now = deps.now ?? (() => new Date());
  return async function resolveSession(
    token: string | null,
  ): Promise<ResolvedIdentitySession | null> {
    if (!token || token.length < 40 || token.length > 64) return null;
    const session = await deps.sessions.findByTokenHash(await sha256Hex(token));
    if (!session || session.revokedAt) return null;
    const current = now();
    const lastSeen = Date.parse(session.lastSeenAt);
    const expiresAt = Date.parse(session.expiresAt);
    if (
      !Number.isFinite(expiresAt) ||
      expiresAt <= current.getTime() ||
      !Number.isFinite(lastSeen) ||
      current.getTime() - lastSeen >= IDLE_TIMEOUT_MS
    ) {
      await deps.sessions.revokeForUser(
        session.id,
        session.userId,
        current.toISOString(),
      );
      return null;
    }
    const user = await deps.users.findById(session.userId);
    if (!user || user.disabledAt) {
      await deps.sessions.revokeForUser(
        session.id,
        session.userId,
        current.toISOString(),
      );
      return null;
    }
    await deps.sessions.touch(session.id, current.toISOString());
    return { sessionId: session.id, userId: user.id, email: user.email };
  };
}
