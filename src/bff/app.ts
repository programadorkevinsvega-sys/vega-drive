import { Hono } from "hono";
import { identityRoutes } from "./identity-routes.js";
import { requireAuthenticatedActor, type AuthenticatedEnv } from "./authentication-middleware.js";
export const app = new Hono<AuthenticatedEnv>();
app.use("*", async (c, next) => {
  await next();
  c.header("X-Content-Type-Options", "nosniff");
  c.header("Referrer-Policy", "strict-origin-when-cross-origin");
  c.header("X-Frame-Options", "DENY");
  c.header("Content-Security-Policy", "default-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'");
  c.header("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  if (c.req.path.startsWith("/api/")) c.header("Cache-Control", "no-store");
});
app.get("/api/health", (c) => c.json({ status: "ok", service: "vega-drive" }, 200));
app.route("/api/auth", identityRoutes);
app.use("/api/protected/*", requireAuthenticatedActor);
app.notFound((c) => c.json({ error: "Not found" }, 404));
