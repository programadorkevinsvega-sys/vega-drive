import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const projectRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const guards = {
  ownership: "verify-module-ownership.mjs",
  sql: "verify-sql-boundaries.mjs",
  r2Port: "verify-r2-port-boundary.mjs",
  frontend: "verify-frontend-boundary.mjs",
  extraction: "verify-module-extraction.mjs",
  r2Privacy: "verify-r2-privacy.mjs",
  bff: "verify-bff-boundary.mjs",
  actor: "verify-authenticated-actor.mjs",
  gateway: "verify-files-gateway-contract.mjs",
};

async function runFixture(
  guard: keyof typeof guards,
  files: Record<string, string>,
) {
  const root = await mkdtemp(join(tmpdir(), "vega-drive-guard-"));
  try {
    for (const [path, content] of Object.entries(files)) {
      const target = join(root, path);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, content);
    }
    const script = join(projectRoot, "scripts/architecture", guards[guard]);
    return spawnSync(process.execPath, [script], {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, VEGA_DRIVE_ROOT: root },
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

describe("independent architecture verification scripts", () => {
  it("rejects source files outside registered module ownership", async () => {
    const result = await runFixture("ownership", {
      "src/modules/unknown/module.ts": "export const value = true;",
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("archivo fuera de un módulo registrado");
  });

  it("rejects SQL that refers to another module's prefix", async () => {
    const result = await runFixture("sql", {
      "src/modules/files/infrastructure/persistence/d1/repository.ts":
        'const query = "SELECT * FROM identity_users";',
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("prefijo ajeno identity_");
  });

  it("rejects R2 binding access outside the files storage adapter", async () => {
    const result = await runFixture("r2Port", {
      "src/bff/app.ts": "const bucket = env.FILES_BUCKET;",
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("fuera del adaptador autorizado de files");
  });

  it("rejects frontend requests outside the same-origin API", async () => {
    const result = await runFixture("frontend", {
      "public/app.js": 'fetch("https://example.com/files");',
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("fetch() debe apuntar");
  });

  it("rejects infrastructure dependencies from domain code", async () => {
    const result = await runFixture("extraction", {
      "src/modules/files/domain/file.ts": 'import "../infrastructure/r2.js";',
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("dominio depende de una capa externa");
  });

  it("rejects public or presigned storage URLs in repository code", async () => {
    const result = await runFixture("r2Privacy", {
      "wrangler.toml": '[[r2_buckets]]\nbinding = "FILES_BUCKET"\n',
      "src/modules/files/storage.ts":
        'const publicUrl = "https://example.r2.dev/file";',
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("URL pública/externalizada de R2/S3");
  });

  it("rejects controllers that import module internals", async () => {
    const result = await runFixture("bff", {
      "src/bff/controllers/files.ts":
        'import { File } from "../../modules/files/domain/file.js";',
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("importar módulos directamente");
  });

  it("rejects authorization sourced from browser-supplied ownerId", async () => {
    const result = await runFixture("actor", {
      "src/bff/controllers/files.ts": "const actor = body.ownerId;",
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("fuente de autorización");
  });

  it("rejects a gateway adapter that omits contract methods", async () => {
    const result = await runFixture("gateway", {
      "src/bff/composition-root.ts":
        "export interface FilesGateway {\n status(): void;\n list(): void;\n}\nexport class InProcessFilesGateway implements FilesGateway {\n status() {}\n}",
      "src/modules/files/module.public-api.ts":
        "export interface FilesPublicApi {}",
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("no implementa el método list");
  });
});
