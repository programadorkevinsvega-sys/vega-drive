import { describe, expect, it, vi } from "vitest";
import worker from "../src/worker/index.js";
import type { Env } from "../src/worker/env.js";

function makeEnv(assetFetch: (request: Request) => Promise<Response>) {
  return {
    ASSETS: { fetch: assetFetch },
    VEGA_DRIVE_DB: {},
    FILES_BUCKET: {},
    TURNSTILE_SECRET_KEY: "test-only-not-a-real-secret",
    TURNSTILE_SITE_KEY: "",
    MAX_USERS: "10",
  } as unknown as Env;
}

const executionContext = {} as unknown as ExecutionContext;

describe("Worker: enrutamiento de frontend y API", () => {
  it("delega los assets estáticos sin alterarlos", async () => {
    const assets = vi.fn(async (request: Request) => {
      const path = new URL(request.url).pathname;
      if (path === "/") {
        return new Response("<!doctype html><div id=\"root\"></div>", {
          headers: { "Content-Type": "text/html; charset=utf-8" },
        });
      }
      if (path.endsWith(".js")) {
        return new Response("export {}", {
          headers: { "Content-Type": "text/javascript; charset=utf-8" },
        });
      }
      if (path.endsWith(".css")) {
        return new Response(":root {}", {
          headers: { "Content-Type": "text/css; charset=utf-8" },
        });
      }
      if (path.endsWith(".svg")) {
        return new Response("<svg></svg>", {
          headers: { "Content-Type": "image/svg+xml" },
        });
      }
      return new Response("Not Found", { status: 404 });
    });
    const env = makeEnv(assets);

    const cases = [
      ["/", "text/html"],
      ["/assets/app.js", "text/javascript"],
      ["/assets/app.css", "text/css"],
      ["/favicon.svg", "image/svg+xml"],
    ] as const;
    for (const [path, contentType] of cases) {
      const response = await worker.fetch(
        new Request(`https://vega-drive.test${path}`),
        env,
        executionContext,
      );
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain(contentType);
    }
    expect(assets).toHaveBeenCalledTimes(cases.length);
  });

  it("no convierte un asset inexistente en index.html", async () => {
    const assets = vi.fn(
      async () => new Response("Not Found", { status: 404 }),
    );
    const response = await worker.fetch(
      new Request("https://vega-drive.test/assets/missing.js"),
      makeEnv(assets),
      executionContext,
    );
    expect(response.status).toBe(404);
    expect(await response.text()).toBe("Not Found");
  });

  it("mantiene /api/health en Hono sin pedir el asset", async () => {
    const assets = vi.fn(async () => new Response("asset"));
    const response = await worker.fetch(
      new Request("https://vega-drive.test/api/health"),
      makeEnv(assets),
      executionContext,
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: "ok",
      service: "vega-drive",
    });
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("content-security-policy")).toContain(
      "default-src 'self'",
    );
    expect(assets).not.toHaveBeenCalled();
  });

  it("devuelve 404 JSON en API desconocida, nunca HTML", async () => {
    const assets = vi.fn(async () => new Response("asset"));
    const response = await worker.fetch(
      new Request("https://vega-drive.test/api/does-not-exist"),
      makeEnv(assets),
      executionContext,
    );
    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(await response.json()).toEqual({ error: "Not found" });
    expect(assets).not.toHaveBeenCalled();
  });
});
