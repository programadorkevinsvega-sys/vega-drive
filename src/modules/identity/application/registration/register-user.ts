import type {
  IdentityAuthAttemptRepository,
  IdentityOutboxRepository,
  IdentityUserRecord,
  IdentityUserRepository,
} from "../ports/identity-repositories.js";
import { hashRateKey } from "../sessions/session-tokens.js";
import { hashPassword, validatePassword } from "./password.js";
import type { TurnstileVerifier } from "./register-user.types.js";

export interface RegisterUserInput {
  email: unknown;
  password: unknown;
  turnstileToken: unknown;
}
export type RegisterUserResult =
  | { ok: true; userId: string }
  | {
      ok: false;
      reason:
        | "invalid-input"
        | "captcha-failed"
        | "registration-closed"
        | "registration-unavailable"
        | "rate-limited";
    };
export interface RegisterUserDependencies {
  users: IdentityUserRepository;
  turnstile: TurnstileVerifier;
  maxUsers: number;
  attempts?: IdentityAuthAttemptRepository;
  outbox?: IdentityOutboxRepository;
  now?: () => Date;
  createId?: () => string;
}
function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  return email.length >= 3 && email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}
export function createRegisterUser(deps: RegisterUserDependencies) {
  const now = deps.now ?? (() => new Date());
  const createId = deps.createId ?? (() => crypto.randomUUID());
  async function audit(eventType: string, userId: string | null, ip: string | null) {
    if (!deps.outbox) return;
    try {
      await deps.outbox.append({
        id: crypto.randomUUID(),
        eventType,
        payloadJson: JSON.stringify({ userId, ip }),
        createdAt: now().toISOString(),
        publishedAt: null,
      });
    } catch {
      // Audit failure must not leak registration details or block registration.
    }
  }
  return async function registerUser(
    input: RegisterUserInput,
    clientIp: string | null = null,
  ): Promise<RegisterUserResult> {
    const email = normalizeEmail(input.email);
    if (!email || !validatePassword(input.password)) {
      return { ok: false, reason: "invalid-input" };
    }
    if (
      typeof input.turnstileToken !== "string" ||
      !input.turnstileToken ||
      input.turnstileToken.length > 2048
    ) {
      await audit("identity.register.captcha-failed", null, clientIp);
      return { ok: false, reason: "captcha-failed" };
    }
    if (
      !Number.isInteger(deps.maxUsers) ||
      deps.maxUsers < 1 ||
      deps.maxUsers > 10
    ) {
      return { ok: false, reason: "registration-closed" };
    }
    const nowMs = now().getTime();
    const ipHash = clientIp
      ? await hashRateKey("register-ip:" + clientIp)
      : null;
    if (ipHash && deps.attempts) {
      const state = await deps.attempts.find(ipHash, nowMs, 900000);
      if (state?.lockedUntil && state.lockedUntil > nowMs) {
        return { ok: false, reason: "rate-limited" };
      }
    }
    let captchaValid = false;
    try {
      captchaValid = await deps.turnstile.verify(input.turnstileToken, clientIp);
    } catch {
      captchaValid = false;
    }
    if (!captchaValid) {
      if (ipHash && deps.attempts) {
        await deps.attempts.recordFailure(ipHash, nowMs, 900000);
      }
      return { ok: false, reason: "captcha-failed" };
    }
    try {
      if (await deps.users.findByNormalizedEmail(email)) {
        await audit("identity.register.rejected", null, clientIp);
        return { ok: false, reason: "registration-unavailable" };
      }
      const createdAt = now().toISOString();
      const credentials = await hashPassword(input.password);
      const user: IdentityUserRecord = {
        id: createId(),
        email,
        ...credentials,
        createdAt,
        updatedAt: createdAt,
        disabledAt: null,
      };
      if (!(await deps.users.insertWithinLimit(user, deps.maxUsers))) {
        await audit("identity.register.rejected", null, clientIp);
        return { ok: false, reason: "registration-closed" };
      }
      if (ipHash && deps.attempts) await deps.attempts.clear(ipHash);
      await audit("identity.register.succeeded", user.id, clientIp);
      return { ok: true, userId: user.id };
    } catch {
      return { ok: false, reason: "registration-unavailable" };
    }
  };
}
