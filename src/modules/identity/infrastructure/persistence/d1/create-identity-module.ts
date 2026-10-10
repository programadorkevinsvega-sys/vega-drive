import type { Env } from "../../../../../worker/env.js";
import { createIdentityModule } from "../../../module.public-api.js";
import { D1IdentityAuthAttemptRepository } from "./d1-identity-auth-attempt.repository.js";
import { D1IdentityOutboxRepository } from "./d1-identity-outbox.repository.js";
import { D1IdentitySessionRepository } from "./d1-identity-session.repository.js";
import { D1IdentityUserRepository } from "./d1-identity-user.repository.js";
import { CloudflareTurnstileVerifier } from "../../turnstile/cloudflare-turnstile-verifier.js";

export function createIdentityModuleFromD1(env: Env) {
  return createIdentityModule({
    users: new D1IdentityUserRepository(env.VEGA_DRIVE_DB),
    sessions: new D1IdentitySessionRepository(env.VEGA_DRIVE_DB),
    attempts: new D1IdentityAuthAttemptRepository(env.VEGA_DRIVE_DB),
    outbox: new D1IdentityOutboxRepository(env.VEGA_DRIVE_DB),
    turnstile: new CloudflareTurnstileVerifier(env.TURNSTILE_SECRET_KEY),
    maxUsers: Number(env.MAX_USERS),
    turnstileSiteKey: env.TURNSTILE_SITE_KEY,
    turnstileSecretConfigured: Boolean(env.TURNSTILE_SECRET_KEY),
  });
}
