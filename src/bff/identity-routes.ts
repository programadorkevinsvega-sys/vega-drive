import { Hono } from "hono";
import type { Env } from "../worker/env.js";
import { createCompositionRoot } from "./composition-root.js";
import { requireAuthenticatedActor, type AuthenticatedEnv } from "./authentication-middleware.js";

const COOKIE = "__Host-session";
const MAX_BODY_BYTES = 64 * 1024;
export const identityRoutes = new Hono<AuthenticatedEnv>();

function readCookie(header: string | undefined): string | null {
  for (const part of (header ?? "").split(";")) {
    const index = part.indexOf("=");
    if (index >= 0 && part.slice(0, index).trim() === COOKIE) {
      const value = part.slice(index + 1).trim();
      return /^[A-Za-z0-9_-]{43}$/.test(value) ? value : null;
    }
  }
  return null;
}

function sessionCookie(token: string): string {
  return (
    COOKIE +
    "=" +
    token +
    "; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=604800"
  );
}

function expiredCookie(): string {
  return (
    COOKIE +
    "=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT"
  );
}

function originAllowed(request: Request): boolean {
  const origin = request.headers.get("Origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

async function strictJson(
  request: Request,
  allowed: string[],
): Promise<Record<string, unknown> | null> {
  const declared = Number(request.headers.get("Content-Length") ?? "0");
  if (declared > MAX_BODY_BYTES) return null;
  const reader = request.body?.getReader();
  if (!reader) return null;
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BODY_BYTES) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    const value = parsed as Record<string, unknown>;
    return Object.keys(value).every((key) => allowed.includes(key))
      ? value
      : null;
  } catch {
    return null;
  } finally {
    reader.releaseLock();
  }
}

function ip(request: Request): string | null {
  const value = request.headers.get("CF-Connecting-IP");
  return value && value.length <= 64 ? value : null;
}

function isReady(env: Env): boolean {
  return createCompositionRoot(env).identity.authConfig().ready;
}

identityRoutes.get("/config", (c) =>
  c.json(createCompositionRoot(c.env).identity.authConfig()),
);

identityRoutes.post("/register", async (c) => {
  if (!originAllowed(c.req.raw)) {
    return c.json({ error: "Invalid request origin" }, 403);
  }
  if (!isReady(c.env)) {
    return c.json({ error: "Authentication is not configured" }, 503);
  }
  const body = await strictJson(c.req.raw, [
    "email",
    "password",
    "turnstileToken",
  ]);
  if (!body) return c.json({ error: "Invalid request" }, 400);
  const result = await createCompositionRoot(c.env).identity.register(
    body,
    ip(c.req.raw),
  );
  if (result.ok) return c.json({ ok: true }, 201);
  if (result.reason === "registration-closed") {
    return c.json({ error: "Registration is unavailable" }, 403);
  }
  if (result.reason === "rate-limited") {
    return c.json({ error: "Too many attempts" }, 429);
  }
  if (result.reason === "invalid-input") {
    return c.json({ error: "Invalid email or password" }, 400);
  }
  return c.json({ error: "Registration could not be completed" }, 400);
});

identityRoutes.post("/login", async (c) => {
  if (!originAllowed(c.req.raw)) {
    return c.json({ error: "Invalid request origin" }, 403);
  }
  if (!isReady(c.env)) {
    return c.json({ error: "Authentication is not configured" }, 503);
  }
  const body = await strictJson(c.req.raw, [
    "email",
    "password",
    "turnstileToken",
  ]);
  if (!body) return c.json({ error: "Invalid request" }, 400);
  const gateway = createCompositionRoot(c.env).identity;
  const result = await gateway.login(
    body,
    ip(c.req.raw),
    readCookie(c.req.header("Cookie")),
  );
  if (!result.ok) {
    return c.json(
      {
        error:
          result.reason === "rate-limited"
            ? "Too many attempts"
            : "Credenciales inválidas",
      },
      result.reason === "rate-limited" ? 429 : 401,
    );
  }
  c.header("Set-Cookie", sessionCookie(result.token));
  return c.json({ ok: true, user: { email: result.email } });
});

identityRoutes.post("/logout", async (c) => {
  if (!originAllowed(c.req.raw)) {
    return c.json({ error: "Invalid request origin" }, 403);
  }
  await createCompositionRoot(c.env).identity.logout(
    readCookie(c.req.header("Cookie")),
  );
  c.header("Set-Cookie", expiredCookie());
  return c.json({ ok: true });
});

identityRoutes.get("/session", async (c) => {
  const actor = await createCompositionRoot(c.env).identity.resolveSession(
    readCookie(c.req.header("Cookie")),
  );
  return actor
    ? c.json({ authenticated: true, user: { email: actor.email } })
    : c.json({ authenticated: false });
});

identityRoutes.use("/password", requireAuthenticatedActor);

identityRoutes.post("/password", async (c) => {
  if (!originAllowed(c.req.raw)) {
    return c.json({ error: "Invalid request origin" }, 403);
  }
  const gateway = createCompositionRoot(c.env).identity;
  const actor = c.get("actor");
  const body = await strictJson(c.req.raw, ["currentPassword", "newPassword"]);
  if (!body) return c.json({ error: "Invalid request" }, 400);
  const result = await gateway.changePassword(
    actor,
    body.currentPassword,
    body.newPassword,
    ip(c.req.raw),
  );
  if (!result.ok) {
    return c.json({ error: "Unable to change password" }, 400);
  }
  c.header("Set-Cookie", sessionCookie(result.token));
  return c.json({ ok: true });
});
