import { app } from "../bff/app.js";
import type { Env } from "./env.js";
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) return app.fetch(request, env, ctx);
    return env.ASSETS.fetch(request);
  },
  async queue(batch: MessageBatch<unknown>, _env: Env): Promise<void> {
    if (batch.messages.length > 0) throw new Error("Queue consumer is not configured yet");
  },
  async scheduled(_controller: ScheduledController, _env: Env, _ctx: ExecutionContext): Promise<void> {
    // No hay tareas programadas en Fase 0.
  },
};
