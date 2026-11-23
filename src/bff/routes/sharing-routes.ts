import { Hono, type Context } from "hono";
import { createCompositionRoot } from "../../worker/composition-root.js";
import { requireAuthenticatedActor, type AuthenticatedEnv } from "../authentication-middleware.js";

export const sharingRoutes = new Hono<AuthenticatedEnv>();
const INVALID = { error: "Invalid request" } as const;
function actor(c: Context<AuthenticatedEnv>) { return { userId: c.get("actor").userId }; }
function originAllowed(request: Request): boolean {
  const origin = request.headers.get("Origin");
  if (!origin) return false;
  try { return new URL(origin).origin === new URL(request.url).origin; } catch { return false; }
}
async function strictBody(request: Request, allowed: string[]): Promise<Record<string, unknown> | null> {
  if (request.headers.get("Content-Type")?.split(";")[0]?.trim().toLowerCase() !== "application/json") return null;
  const length = request.headers.get("Content-Length");
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > 4096)) return null;
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) return null;
    const record = body as Record<string, unknown>;
    return Object.keys(record).every((key) => allowed.includes(key)) ? record : null;
  } catch { return null; }
}
function failure(c: Context<AuthenticatedEnv>, reason: string) {
  if (reason === "invalid-input") return c.json(INVALID, 400);
  if (reason === "not-found") return c.json({ error: "Share not found" }, 404);
  if (reason === "rate-limited") return c.json({ error: "Share creation limit reached" }, 429);
  return c.json({ error: "Sharing temporarily unavailable" }, 503);
}
sharingRoutes.get("/", requireAuthenticatedActor, async (c) => {
  if (new URL(c.req.url).search) return c.json(INVALID, 400);
  const result = await createCompositionRoot(c.env).sharing.list(actor(c));
  return result.ok ? c.json(result.value) : failure(c, result.reason);
});
sharingRoutes.post("/", requireAuthenticatedActor, async (c) => {
  if (!originAllowed(c.req.raw) || new URL(c.req.url).search) return c.json(INVALID, 403);
  const body = await strictBody(c.req.raw, ["itemId", "expiresInSeconds"]);
  if (!body || !Object.hasOwn(body, "itemId")) return c.json(INVALID, 400);
  const result = await createCompositionRoot(c.env).sharing.create(actor(c), body.itemId, body.expiresInSeconds);
  return result.ok ? c.json(result.value, 201) : failure(c, result.reason);
});
sharingRoutes.delete("/:id", requireAuthenticatedActor, async (c) => {
  if (!originAllowed(c.req.raw) || new URL(c.req.url).search) return c.json(INVALID, 400);
  const result = await createCompositionRoot(c.env).sharing.revoke(actor(c), c.req.param("id"));
  return result.ok ? c.json(result.value) : failure(c, result.reason);
});
sharingRoutes.get("/:token", async (c) => {
  const result = await createCompositionRoot(c.env).sharing.download(c.req.param("token"), c.req.header("Range") ?? null);
  if (!result.ok) {
    if (result.reason === "range-not-satisfiable") return c.body(null, 416, { "Content-Range": "bytes */" + (result.totalSizeBytes ?? 0), "Cache-Control": "no-store" });
    return c.json({ error: "This share link is invalid, expired, or revoked" }, 404);
  }
  const value = result.value;
  const safeName = value.name.replace(/[\\r\\n\\"]/g, "_").slice(0, 180) || "download";
  const headers = new Headers({
    "Content-Type": value.contentType,
    "Content-Length": String(value.contentLength),
    "Content-Disposition": "attachment; filename*=UTF-8''" + encodeURIComponent(safeName),
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "private, no-store",
    "Referrer-Policy": "no-referrer",
    "Accept-Ranges": "bytes",
  });
  if (value.contentRange) headers.set("Content-Range", value.contentRange);
  return new Response(value.body, { status: value.status, headers });
});
