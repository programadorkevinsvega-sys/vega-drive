import type {
  IdentityAuthAttemptRepository,
  IdentityOutboxRepository,
  IdentitySessionRepository,
  IdentityUserRepository,
} from "../ports/identity-repositories.js";
import type { TurnstileVerifier } from "../registration/register-user.types.js";
import { verifyPassword } from "../registration/password.js";
import { createSession, hashRateKey, sha256Hex } from "../sessions/session-tokens.js";

export interface LoginUserInput {
  email: unknown;
  password: unknown;
  turnstileToken: unknown;
}
export type LoginUserResult =
  | { ok: true; token: string; email: string; userId: string }
  | {
      ok: false;
      reason: "invalid-credentials" | "captcha-failed" | "rate-limited";
    };

const WINDOW_MS = 15 * 60 * 1000;
const DUMMY_HASH = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
const DUMMY_SALT = "AAAAAAAAAAAAAAAAAAAAAA==";

export function createLoginUser(deps: {
  users: IdentityUserRepository;
  sessions: IdentitySessionRepository;
  attempts: IdentityAuthAttemptRepository;
  turnstile: TurnstileVerifier;
  outbox: IdentityOutboxRepository;
  now?: () => Date;
}) {
  const now = deps.now ?? (() => new Date());
  async function audit(
    eventType: string,
    emailKey: string,
    ipKey: string | null,
  ) {
    try {
      await deps.outbox.append({
        id: crypto.randomUUID(),
        eventType,
        payloadJson: JSON.stringify({ emailKey, ipKey }),
        createdAt: now().toISOString(),
        publishedAt: null,
      });
    } catch {
      // Audit failure must not leak authentication details.
    }
  }
  return async function login(
    input: LoginUserInput,
    ip: string | null,
    previousToken: string | null,
  ): Promise<LoginUserResult> {
    const email =
      typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
    const password = typeof input.password === "string" ? input.password : "";
    const token =
      typeof input.turnstileToken === "string" ? input.turnstileToken : "";
    if (
      email.length > 254 ||
      password.length > 128 ||
      !token ||
      token.length > 2048
    ) {
      return { ok: false, reason: "invalid-credentials" };
    }
    const emailKey = await hashRateKey("email:" + (email || "invalid"));
    const ipKey = ip ? await hashRateKey("ip:" + ip) : null;
    const timestamp = now().getTime();
    for (const key of [emailKey, ipKey].filter(
      (value): value is string => Boolean(value),
    )) {
      const state = await deps.attempts.find(key, timestamp, WINDOW_MS);
      if (state?.lockedUntil && state.lockedUntil > timestamp) {
        return { ok: false, reason: "rate-limited" };
      }
    }
    if (!(await deps.turnstile.verify(token, ip))) {
      if (ipKey) await deps.attempts.recordFailure(ipKey, timestamp, WINDOW_MS);
      return { ok: false, reason: "captcha-failed" };
    }
    const user = email ? await deps.users.findByNormalizedEmail(email) : null;
    const valid = await verifyPassword(
      password,
      user?.passwordHash ?? DUMMY_HASH,
      user?.passwordSalt ?? DUMMY_SALT,
    );
    if (!user || user.disabledAt || !valid) {
      await deps.attempts.recordFailure(emailKey, timestamp, WINDOW_MS);
      if (ipKey) await deps.attempts.recordFailure(ipKey, timestamp, WINDOW_MS);
      await audit("identity.login.failed", emailKey, ipKey);
      return { ok: false, reason: "invalid-credentials" };
    }
    const created = await createSession(user.id, deps.sessions, now());
    if (previousToken) {
      const previous = await deps.sessions.findByTokenHash(
        await sha256Hex(previousToken),
      );
      if (previous && previous.userId === user.id && !previous.revokedAt) {
        await deps.sessions.revokeForUser(
          previous.id,
          previous.userId,
          now().toISOString(),
        );
      }
    }
    await deps.attempts.clear(emailKey);
    await audit("identity.login.succeeded", emailKey, ipKey);
    return {
      ok: true,
      token: created.token,
      email: user.email,
      userId: user.id,
    };
  };
}
