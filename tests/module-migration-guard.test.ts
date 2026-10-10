import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const guardPath = fileURLToPath(
  new URL("../scripts/check-module-migrations.mjs", import.meta.url),
);
const validPattern =
  "src/modules/*/infrastructure/persistence/d1/migrations/*.sql";
const validConfig = [
  'name = "vega-drive-test"',
  "",
  "[[d1_databases]]",
  'binding = "VEGA_DRIVE_DB"',
  'migrations_dir = "src/modules"',
  'migrations_pattern = "' + validPattern + '"',
  "",
].join("\n");

async function runGuard(options: {
  files?: Record<string, string>;
  config?: string;
}) {
  const root = await mkdtemp(join(tmpdir(), "vega-drive-migrations-guard-"));
  try {
    await writeFile(join(root, "wrangler.toml"), options.config ?? validConfig);
    const files = {
      "src/modules/files/infrastructure/persistence/d1/migrations/0001_files_initial.sql":
        "CREATE TABLE files_items (id TEXT PRIMARY KEY); CREATE INDEX files_items_id_idx ON files_items (id);",
      "src/modules/identity/infrastructure/persistence/d1/migrations/0001_identity_initial.sql":
        "CREATE TABLE identity_users (id TEXT PRIMARY KEY);",
      ...options.files,
    };
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

describe("module migration ownership guard", () => {
  it("accepts module-owned migrations with the active Wrangler pattern", async () => {
    const result = await runGuard({
      files: {
        "migrations/0001_initial_schema.sql":
          "CREATE TABLE identity_users (id TEXT PRIMARY KEY);",
      },
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Propiedad de migraciones D1 OK");
  });

  it("rejects a migration that creates a table owned by another module", async () => {
    const result = await runGuard({
      files: {
        "src/modules/files/infrastructure/persistence/d1/migrations/0002_bad_table.sql":
          "CREATE TABLE identity_sessions (id TEXT PRIMARY KEY);",
      },
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(
      "la tabla identity_sessions no pertenece al módulo files",
    );
    expect(result.stderr).toContain("Despliegue bloqueado");
  });

  it("rejects an index in one module that targets another module's table", async () => {
    const result = await runGuard({
      files: {
        "src/modules/files/infrastructure/persistence/d1/migrations/0002_bad_index.sql":
          "CREATE INDEX files_bad_idx ON identity_users (id);",
      },
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("apunta a la tabla ajena identity_users");
  });

  it("rejects a broken Wrangler migration directory or pattern", async () => {
    const badConfig = validConfig.replace(validPattern, "migrations/*.sql");
    const result = await runGuard({ config: badConfig });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("migrations_pattern debe ser");
  });

  it("rejects SQL placed outside a module-owned migration directory", async () => {
    const result = await runGuard({
      files: {
        "src/modules/files/migrations/0002_bad_location.sql":
          "CREATE TABLE files_bad (id TEXT PRIMARY KEY);",
      },
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("SQL debe vivir en");
  });
});
