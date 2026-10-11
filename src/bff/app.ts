import { Hono } from "hono";
import { SECURITY_HEADERS } from "./security-headers.js";
import { identityRoutes } from "./identity-routes.js";
import {
  requireAuthenticatedActor,
  type AuthenticatedEnv,
} from "./authentication-middleware.js";

export const app = new Hono<AuthenticatedEnv>();

app.use("*", async (c, next) => {
  await next();
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    c.header(name, value);
  }
  if (c.req.path.startsWith("/api/")) c.header("Cache-Control", "no-store");
});

app.get("/api/health", (c) =>
  c.json({ status: "ok", service: "vega-drive" }, 200),
);
app.route("/api/auth", identityRoutes);
app.use("/api/protected/*", requireAuthenticatedActor);
app.notFound((c) => c.json({ error: "Not found" }, 404));
