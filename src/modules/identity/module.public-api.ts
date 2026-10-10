import type { ModuleStatus } from "../../worker/env.js";
import type {
  IdentityAuthAttemptRepository,
  IdentityOutboxRepository,
  IdentitySessionRepository,
  IdentityUserRepository,
} from "./application/ports/identity-repositories.js";
import { createChangePassword } from "./application/authentication/change-password.js";
import {
  createLoginUser,
  type LoginUserInput,
} from "./application/authentication/login-user.js";
import {
  createRegisterUser,
  type RegisterUserInput,
} from "./application/registration/register-user.js";
import type { TurnstileVerifier } from "./application/registration/register-user.types.js";
import {
  createSessionResolver,
  type ResolvedIdentitySession,
} from "./application/sessions/resolve-session.js";
import { sha256Hex } from "./application/sessions/session-tokens.js";

export interface IdentityPublicApi {
  status(): ModuleStatus;
  authConfig(): { turnstileSiteKey: string; ready: boolean };
  register(
    input: RegisterUserInput,
    ip: string | null,
  ): ReturnType<ReturnType<typeof createRegisterUser>>;
  login(
    input: LoginUserInput,
    ip: string | null,
    previousToken: string | null,
  ): ReturnType<ReturnType<typeof createLoginUser>>;
  logout(token: string | null): Promise<void>;
  resolveSession(token: string | null): Promise<ResolvedIdentitySession | null>;
  changePassword(
    actor: ResolvedIdentitySession,
    current: unknown,
    next: unknown,
    ip: string | null,
  ): ReturnType<ReturnType<typeof createChangePassword>>;
}

export interface IdentityModuleDependencies {
  users: IdentityUserRepository;
  sessions: IdentitySessionRepository;
  attempts: IdentityAuthAttemptRepository;
  outbox: IdentityOutboxRepository;
  turnstile: TurnstileVerifier;
  maxUsers: number;
  turnstileSiteKey: string;
  turnstileSecretConfigured: boolean;
}

export function createIdentityModule(
  deps: IdentityModuleDependencies,
): IdentityPublicApi {
  const {
    users,
    sessions,
    attempts,
    outbox,
    turnstile,
    maxUsers,
    turnstileSiteKey,
    turnstileSecretConfigured,
  } = deps;
  const register = createRegisterUser({
    users,
    turnstile,
    attempts,
    outbox,
    maxUsers,
  });
  const login = createLoginUser({ users, sessions, attempts, turnstile, outbox });
  const resolveSession = createSessionResolver({ sessions, users });
  const changePassword = createChangePassword({ users, sessions, outbox });
  const ready = Boolean(turnstileSiteKey && turnstileSecretConfigured);
  return {
    status: () => ({ module: "identity", ready }),
    authConfig: () => ({ turnstileSiteKey, ready }),
    register: (input, ip) => register(input, ip),
    login: (input, ip, previous) => login(input, ip, previous),
    async logout(token) {
      if (!token) return;
      const session = await sessions.findByTokenHash(await sha256Hex(token));
      if (session && !session.revokedAt) {
        await sessions.revokeForUser(
          session.id,
          session.userId,
          new Date().toISOString(),
        );
      }
    },
    resolveSession: (token) => resolveSession(token),
    changePassword: (actor, current, next, ip) =>
      changePassword(actor, current, next, ip),
  };
}
