import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const root = new URL("../", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), "utf8");

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
    const deployWorkflow = read(".github/workflows/deploy-cloudflare.yml");
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
    const deploy = rootPackage.scripts["deploy"];
    if (deploy === undefined) {
      throw new Error("Falta el script deploy en package.json.");
    }
    expect(deploy).toMatch(/^pnpm run cloudflare:build &&/);
    expect(deploy).toContain("pnpm run deploy:release");

    const cloudflareBuild = rootPackage.scripts["cloudflare:build"];
    if (cloudflareBuild === undefined) {
      throw new Error("Falta el script cloudflare:build en package.json.");
    }
    expect(cloudflareBuild).toMatch(/^pnpm run deploy:preflight &&/);
    expect(cloudflareBuild).toContain("pnpm run check");
    expect(cloudflareBuild).toContain("pnpm run frontend:install");
    expect(cloudflareBuild).toContain("pnpm run frontend:check");
    expect(cloudflareBuild.indexOf("pnpm run frontend:install")).toBeLessThan(
      cloudflareBuild.indexOf("pnpm run frontend:check"),
    );
    expect(cloudflareBuild).toContain("pnpm run frontend:audit");
    expect(cloudflareBuild).toContain("wrangler deploy --dry-run");

    const release = rootPackage.scripts["deploy:release"];
    if (release === undefined) {
      throw new Error("Falta el script deploy:release en package.json.");
    }
    const migrationIndex = release.indexOf("pnpm run db:migrate:production");
    const databaseVerificationIndex = release.indexOf(
      "pnpm run db:verify:production",
    );
    const workerDeployIndex = release.indexOf("pnpm exec wrangler deploy");
    const productionVerificationIndex = release.indexOf(
      "pnpm run verify:production",
    );
    expect(migrationIndex).toBeGreaterThanOrEqual(0);
    expect(databaseVerificationIndex).toBeGreaterThan(migrationIndex);
    expect(workerDeployIndex).toBeGreaterThan(databaseVerificationIndex);
    expect(productionVerificationIndex).toBeGreaterThan(workerDeployIndex);
    expect(release).not.toContain("pnpm run verify:production:auth-config");
    expect(frontendPackage.scripts.check).toBe(
      "pnpm run typecheck && pnpm run test && pnpm run build",
    );
    expect(workflow).toContain("frontend/pnpm-lock.yaml");
    expect(workflow).not.toContain("pnpm run cloudflare:build");
    expect(deployWorkflow).toContain("workflow_dispatch:");
    expect(deployWorkflow).not.toContain("push:");
    expect(deployWorkflow).toContain("run: pnpm run deploy:release");
  });

  it("fija Node.js y usa las opciones soportadas de observabilidad de Wrangler", () => {
    expect(read(".nvmrc").trim()).toBe("22.23.5");
    const toml = read("wrangler.toml");
    const jsonc = read("wrangler.jsonc");
    expect(toml).toContain("[observability.issues]");
    expect(jsonc).toContain('"issues": {');
    expect(toml).not.toContain("issue_detection");
    expect(jsonc).not.toContain('"issue_detection"');
  });
});
