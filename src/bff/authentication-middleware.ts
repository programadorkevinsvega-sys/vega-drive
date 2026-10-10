import { createMiddleware } from "hono/factory";
import type { Env } from "../worker/env.js";
import { createCompositionRoot } from "./composition-root.js";
import type { AuthenticatedActor } from "./authenticated-actor.js";

export type AuthenticatedEnv = {
  Bindings: Env;
  Variables: { actor: AuthenticatedActor };
};

function sessionToken(cookie: string | undefined): string | null {
  for (const part of (cookie ?? "").split(";")) {
    const index = part.indexOf("=");
    if (index >= 0 && part.slice(0, index).trim() === "__Host-session") {
      const token = part.slice(index + 1).trim();
      return /^[A-Za-z0-9_-]{43}$/.test(token) ? token : null;
    }
  }
  return null;
}

export const requireAuthenticatedActor =
  createMiddleware<AuthenticatedEnv>(async (c, next) => {
    const session = await createCompositionRoot(c.env).identity.resolveSession(
      sessionToken(c.req.header("Cookie")),
    );
    if (!session) return c.json({ error: "Authentication required" }, 401);
    c.set("actor", {
      userId: session.userId,
      sessionId: session.sessionId,
      email: session.email,
    });
    await next();
  });
