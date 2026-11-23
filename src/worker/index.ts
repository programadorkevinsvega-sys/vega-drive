import { app } from "../bff/app.js";
import { SECURITY_HEADERS } from "../bff/security-headers.js";
import type { Env } from "./env.js";
import { createCompositionRoot } from "./composition-root.js";

function secureResponse(response: Response, api: boolean): Response {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    if (!headers.has(name)) headers.set(name, value);
  }
  if (api) headers.set("Cache-Control", "no-store");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    const url = new URL(request.url);
    const api = url.pathname === "/api" || url.pathname.startsWith("/api/");
    const response = api
      ? await app.fetch(request, env, ctx)
      : await env.ASSETS.fetch(request);
    return secureResponse(response, api);
  },

  async scheduled(
    controller: ScheduledController,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<void> {
    const nowIso = new Date(controller.scheduledTime).toISOString();
    const files = createCompositionRoot(env).files;
    ctx.waitUntil(
      Promise.all([
        files.cleanupExpiredUploads(nowIso, 100),
        files.cleanupExpiredTrash(nowIso, 10),
      ]).then(() => undefined),
    );
  },
};
