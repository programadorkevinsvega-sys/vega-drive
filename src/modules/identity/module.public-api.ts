import type { Env, ModuleStatus } from "../../worker/env.js";
import { createChangePassword } from "./application/authentication/change-password.js";
import { createLoginUser, type LoginUserInput } from "./application/authentication/login-user.js";
import { createRegisterUser, type RegisterUserInput } from "./application/registration/register-user.js";
import { createSessionResolver, type ResolvedIdentitySession } from "./application/sessions/resolve-session.js";
import { sha256Hex } from "./application/sessions/session-tokens.js";
import { D1IdentityAuthAttemptRepository } from "./infrastructure/persistence/d1/d1-identity-auth-attempt.repository.js";
import { D1IdentityOutboxRepository } from "./infrastructure/persistence/d1/d1-identity-outbox.repository.js";
import { D1IdentitySessionRepository } from "./infrastructure/persistence/d1/d1-identity-session.repository.js";
import { D1IdentityUserRepository } from "./infrastructure/persistence/d1/d1-identity-user.repository.js";
import { CloudflareTurnstileVerifier } from "./infrastructure/turnstile/cloudflare-turnstile-verifier.js";
export interface IdentityPublicApi {
  status(): ModuleStatus;
  authConfig(): { turnstileSiteKey: string; ready: boolean };
  register(input: RegisterUserInput, ip: string | null): ReturnType<ReturnType<typeof createRegisterUser>>;
  login(input: LoginUserInput, ip: string | null, previousToken: string | null): ReturnType<ReturnType<typeof createLoginUser>>;
  logout(token: string | null): Promise<void>;
  resolveSession(token: string | null): Promise<ResolvedIdentitySession | null>;
  changePassword(actor: ResolvedIdentitySession, current: unknown, next: unknown): ReturnType<ReturnType<typeof createChangePassword>>;
}
export function createIdentityModule(env: Env): IdentityPublicApi {
  const users = new D1IdentityUserRepository(env.VEGA_DRIVE_DB);
  const sessions = new D1IdentitySessionRepository(env.VEGA_DRIVE_DB);
  const attempts = new D1IdentityAuthAttemptRepository(env.VEGA_DRIVE_DB);
  const outbox = new D1IdentityOutboxRepository(env.VEGA_DRIVE_DB);
  const turnstile = new CloudflareTurnstileVerifier(env.TURNSTILE_SECRET_KEY);
  const register = createRegisterUser({ users, turnstile, attempts, outbox, maxUsers: Number(env.MAX_USERS) });
  const login = createLoginUser({ users, sessions, attempts, turnstile, outbox });
  const resolveSession = createSessionResolver({ sessions, users });
  const changePassword = createChangePassword({ users, sessions });
  const ready = Boolean(env.TURNSTILE_SITE_KEY && env.TURNSTILE_SECRET_KEY);
  return {
    status: () => ({ module: "identity", ready }),
    authConfig: () => ({ turnstileSiteKey: env.TURNSTILE_SITE_KEY, ready }),
    register: (input, ip) => register(input, ip),
    login: (input, ip, previous) => login(input, ip, previous),
    async logout(token) {
      if (!token) return;
      const session = await sessions.findByTokenHash(await sha256Hex(token));
      if (session && !session.revokedAt) await sessions.revokeForUser(session.id, session.userId, new Date().toISOString());
    },
    resolveSession: (token) => resolveSession(token),
    changePassword: (actor, current, next) => changePassword(actor, current, next),
  };
}
