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

describe("architecture guard", () => {
  it("is wired into lint", async () => {
    const pkg = JSON.parse(
      await readFile(resolve("package.json"), "utf8"),
    ) as { scripts: Record<string, string> };

    expect(pkg.scripts.lint).toContain("architecture-check.mjs");
  });

  it.each([
    {
      name: "cross-module internal imports",
      path: "src/modules/files/repository.ts",
      source: 'import "../identity/repository.js";',
      expectedError: "importa interior de identity",
    },
    {
      name: "foreign module SQL tables",
      path: "src/modules/files/repository.ts",
      source: 'const query = "SELECT * FROM identity_users";',
      expectedError: "prefijo de otro módulo",
    },
    {
      name: "JOIN statements",
      path: "src/modules/files/repository.ts",
      source: [
        "const query = ",
        JSON.stringify("SELECT * FROM files_items JOIN files_folders"),
        ";",
      ].join(""),
      expectedError: "JOIN no permitido",
    },
    {
      name: "foreign keys",
      path: "src/modules/files/repository.ts",
      source: [
        "const query = ",
        JSON.stringify("FOREIGN KEY (owner_id) REFERENCES identity_users(id)"),
        ";",
      ].join(""),
      expectedError: "FOREIGN KEY no permitida",
    },
    {
      name: "database batch calls",
      path: "src/modules/files/repository.ts",
      source: "await db.batch(statements);",
      expectedError: "db.batch() requiere revisión explícita",
    },
    {
      name: "R2 binding outside files",
      path: "src/bff/app.ts",
      source: "const bucket = env.FILES_BUCKET;",
      expectedError: "acceso a FILES_BUCKET fuera de files",
    },
  ])("rejects $name", async ({ path, source, expectedError }) => {
    const result = await runGuard({ [path]: source });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(expectedError);
  });

  it("allows imports through another module's public API", async () => {
    const result = await runGuard({
      "src/modules/files/service.ts":
        'import type { IdentityPublicApi } from "../identity/module.public-api.js";',
      "src/modules/identity/module.public-api.ts":
        "export interface IdentityPublicApi {}",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Fronteras arquitectónicas OK");
  });
});
