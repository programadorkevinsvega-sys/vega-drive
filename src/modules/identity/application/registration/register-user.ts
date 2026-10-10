import type {
  IdentityUserRecord,
  IdentityUserRepository,
} from "../ports/identity-repositories.js";
import { hashPassword, validatePassword } from "./password.js";

export interface TurnstileVerifier {
  verify(token: string): Promise<boolean>;
}

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
        | "registration-unavailable";
    };

export interface RegisterUserDependencies {
  users: IdentityUserRepository;
  turnstile: TurnstileVerifier;
  maxUsers: number;
  now?: () => Date;
  createId?: () => string;
}

function normalizeEmail(email: unknown): string | null {
  if (typeof email !== "string") return null;
  const normalized = email.trim().toLowerCase();
  if (
    normalized.length > 254 ||
    normalized.length < 3 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)
  ) {
    return null;
  }
  return normalized;
}

function validMaxUsers(maxUsers: number): boolean {
  return Number.isInteger(maxUsers) && maxUsers >= 1 && maxUsers <= 10;
}

export function createRegisterUser(dependencies: RegisterUserDependencies) {
  const now = dependencies.now ?? (() => new Date());
  const createId = dependencies.createId ?? (() => crypto.randomUUID());

  return async function registerUser(
    input: RegisterUserInput,
  ): Promise<RegisterUserResult> {
    const email = normalizeEmail(input.email);
    if (!email || !validatePassword(input.password)) {
      return { ok: false, reason: "invalid-input" };
    }

    if (
      typeof input.turnstileToken !== "string" ||
      input.turnstileToken.length < 1 ||
      input.turnstileToken.length > 2048
    ) {
      return { ok: false, reason: "captcha-failed" };
    }

    if (!validMaxUsers(dependencies.maxUsers)) {
      return { ok: false, reason: "registration-closed" };
    }

    let captchaValid = false;
    try {
      captchaValid = await dependencies.turnstile.verify(input.turnstileToken);
    } catch {
      captchaValid = false;
    }
    if (!captchaValid) return { ok: false, reason: "captcha-failed" };

    try {
      // This early check avoids expensive hashing for a known duplicate. The
      // unique constraint remains authoritative for concurrent registrations.
      if (await dependencies.users.findByNormalizedEmail(email)) {
        return { ok: false, reason: "registration-unavailable" };
      }

      const timestamp = now().toISOString();
      const credentials = await hashPassword(input.password);
      const user: IdentityUserRecord = {
        id: createId(),
        email,
        ...credentials,
        createdAt: timestamp,
        updatedAt: timestamp,
        disabledAt: null,
      };

      const inserted = await dependencies.users.insertWithinLimit(
        user,
        dependencies.maxUsers,
      );
      if (!inserted) return { ok: false, reason: "registration-closed" };
      return { ok: true, userId: user.id };
    } catch {
      // Do not leak database errors or disclose whether an email is registered.
      return { ok: false, reason: "registration-unavailable" };
    }
  };
}
