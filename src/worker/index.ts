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
    ctx.waitUntil(
      createCompositionRoot(env).files.cleanupExpiredUploads(nowIso, 100),
    );
  },
};
