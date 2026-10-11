import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const root = new URL("../", import.meta.url);
const read = (path: string) =>
  readFileSync(new URL(path, root), "utf8");

describe("integración de assets frontend/Cloudflare", () => {
  it("sirve el build de Vite y conserva API y 404 separados", () => {
    const config = read("wrangler.toml");
    expect(config).toContain('directory = "./frontend/dist"');
    expect(config).toContain('binding = "ASSETS"');
    expect(config).toContain('run_worker_first = ["/api/*"]');
    expect(config).toContain('not_found_handling = "none"');
    expect(config).toContain('binding = "VEGA_DRIVE_DB"');
    expect(config).toContain('binding = "FILES_BUCKET"');
    expect(config).not.toContain('directory = "./public"');
  });

  it("define las cabeceras esperadas para todos los assets estáticos", () => {
    const headers = read("frontend/public/_headers");
    expect(headers).toContain("/*");
    expect(headers).toContain("Content-Security-Policy: default-src 'self'");
    expect(headers).toContain("object-src 'none'");
    expect(headers).toContain("base-uri 'self'");
    expect(headers).toContain("frame-ancestors 'none'");
    expect(headers).toContain("X-Content-Type-Options: nosniff");
    expect(headers).toContain(
      "Referrer-Policy: strict-origin-when-cross-origin",
    );
    expect(headers).toContain("X-Frame-Options: DENY");
    expect(headers).toContain(
      "Strict-Transport-Security: max-age=31536000; includeSubDomains",
    );
  });

  it("mantiene el check frontend y los lockfiles separados", () => {
    const rootPackage = JSON.parse(read("package.json")) as {
      scripts: Record<string, string>;
    };
    const frontendPackage = JSON.parse(read("frontend/package.json")) as {
      scripts: Record<string, string>;
    };
    const workflow = read(".github/workflows/ci.yml");
    expect(rootPackage.scripts["frontend:install"]).toContain(
      "--ignore-workspace --frozen-lockfile",
    );
    expect(rootPackage.scripts["frontend:check"]).toContain("run check");
    expect(rootPackage.scripts["frontend:audit"]).toContain(
      "audit --audit-level=high",
    );
    expect(rootPackage.scripts["cloudflare:build"]).toContain(
      "wrangler deploy --dry-run",
    );
    expect(rootPackage.scripts["deploy"]).toMatch(
      /^pnpm run cloudflare:build &&/,
    );
    expect(frontendPackage.scripts.check).toBe(
      "pnpm run typecheck && pnpm run test && pnpm run build",
    );
    expect(workflow).toContain("frontend/pnpm-lock.yaml");
    expect(workflow).toContain("pnpm run frontend:install");
    expect(workflow).toContain("pnpm run cloudflare:build");
  });
});
