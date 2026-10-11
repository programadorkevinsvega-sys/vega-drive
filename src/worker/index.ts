import { app } from "../bff/app.js";
import type { Env } from "./env.js";
import { createCompositionRoot } from "./composition-root.js";

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
      return app.fetch(request, env, ctx);
    }
    return env.ASSETS.fetch(request);
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
