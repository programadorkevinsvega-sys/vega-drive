import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const guardPath = fileURLToPath(
  new URL("../scripts/architecture-check.mjs", import.meta.url),
);

async function runGuard(files: Record<string, string>) {
  const root = await mkdtemp(join(tmpdir(), "vega-drive-architecture-"));
  try {
    for (const [path, content] of Object.entries(files)) {
      const target = join(root, path);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, content);
    }
    return spawnSync(process.execPath, [guardPath], {
      cwd: root,
      encoding: "utf8",
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

function expectRejected(
  result: ReturnType<typeof spawnSync>,
  expectedError: string,
) {
  expect(result.status).not.toBe(0);
  expect(result.stderr).toContain(expectedError);
}

describe("architecture guard", () => {
  it("is wired into lint", async () => {
    const pkg = JSON.parse(await readFile(resolve("package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };

    expect(pkg.scripts.lint).toContain("architecture-check.mjs");
  });

  it("runs migration ownership and architecture guards before remote deploy work", async () => {
    const pkg = JSON.parse(await readFile(resolve("package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };

    expect(pkg.scripts["deploy:preflight"]).toContain("verify:module-migrations");
    expect(pkg.scripts["deploy:preflight"]).toContain("verify:architecture");
    expect(pkg.scripts["verify:module-migrations"]).toContain(
      "check-module-migrations.mjs",
    );
    expect(pkg.scripts.deploy).toMatch(/^pnpm run deploy:preflight &&/);
    expect(pkg.scripts["cloudflare:build"]).toMatch(
      /^pnpm run deploy:preflight &&/,
    );
  });

  it("rejects cross-module internal imports", async () => {
    const result = await runGuard({
      "src/modules/files/repository.ts": 'import "../identity/repository.js";',
    });

    expectRejected(result, "importa interior de identity");
  });

  it("rejects SQL that references another module's tables", async () => {
    const result = await runGuard({
      "src/modules/files/repository.ts":
        'const query = "SELECT * FROM identity_users";',
    });

    expectRejected(result, "prefijo de otro módulo");
  });

  it("rejects JOIN statements in modules", async () => {
    const query = "SELECT * FROM files_items JOIN files_folders";
    const source = "const query = " + JSON.stringify(query) + ";";
    const result = await runGuard({
      "src/modules/files/repository.ts": source,
    });

    expectRejected(result, "JOIN no permitido");
  });

  it("rejects foreign keys in modules", async () => {
    const query = "FOREIGN KEY (owner_id) REFERENCES identity_users(id)";
    const source = "const query = " + JSON.stringify(query) + ";";
    const result = await runGuard({
      "src/modules/files/repository.ts": source,
    });

    expectRejected(result, "FOREIGN KEY no permitida");
  });

  it("rejects db.batch calls in modules", async () => {
    const result = await runGuard({
      "src/modules/files/repository.ts": "await db.batch(statements);",
    });

    expectRejected(result, "db.batch() requiere revisión explícita");
  });

  it("rejects D1 binding access outside module persistence infrastructure", async () => {
    const result = await runGuard({
      "src/bff/app.ts": "const database = env.VEGA_DRIVE_DB;",
    });

    expectRejected(
      result,
      "acceso a VEGA_DRIVE_DB fuera de infraestructura D1",
    );
  });

  it("rejects D1 database types outside module persistence infrastructure", async () => {
    const result = await runGuard({
      "src/modules/files/application/repository-port.ts":
        "export interface BadPort { db: D1Database; }",
    });

    expectRejected(result, "tipo D1 expuesto fuera de infraestructura");
  });

  it("rejects R2 access outside the files module", async () => {
    const result = await runGuard({
      "src/bff/app.ts": "const bucket = env.FILES_BUCKET;",
    });

    expectRejected(result, "acceso a FILES_BUCKET fuera de files");
  });

  it("rejects cross-module SQL inside an owned D1 migration", async () => {
    const result = await runGuard({
      "src/modules/files/infrastructure/persistence/d1/migrations/0002_bad.sql":
        "CREATE INDEX files_bad_idx ON identity_users(id);",
    });

    expectRejected(result, "prefijo de otro módulo");
  });

  it("allows imports through another module's public API", async () => {
    const publicImport =
      "import type { IdentityPublicApi } from " +
      JSON.stringify("../identity/module.public-api.js") +
      ";";
    const result = await runGuard({
      "src/modules/files/service.ts": publicImport,
      "src/modules/identity/module.public-api.ts":
        "export interface IdentityPublicApi {}",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Fronteras arquitectónicas OK");
  });
});
