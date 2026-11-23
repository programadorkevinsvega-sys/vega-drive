import { readFile, readdir } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";
import { describe, expect, it } from "vitest";

const modulesRoot = resolve("src/modules");
const legacyMigrationPath = resolve("migrations/0001_initial_schema.sql");

async function walk(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(path)));
    else if (entry.isFile() && entry.name.endsWith(".sql")) files.push(path);
  }
  return files;
}

function definitions(sql: string): Map<string, string> {
  const statements = sql
    .replace(/^\s*--.*$/gm, "")
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean);
  const output = new Map<string, string>();

  for (const statement of statements) {
    const match = statement.match(
      /^CREATE\s+(TABLE|(?:UNIQUE\s+)?INDEX)\s+(?:IF\s+NOT\s+EXISTS\s+)?(["'`]?)([\w]+)\2/i,
    );
    if (!match) continue;
    const kind = /^TABLE$/i.test(match[1] ?? "") ? "table" : "index";
    const name = match[3];
    if (!name || (kind === "index" && /^sqlite_/i.test(name))) continue;
    const normalized = statement
      .replace(/\bIF\s+NOT\s+EXISTS\b/gi, "")
      .replace(/\s+/g, " ")
      .replace(/\s*([(),])\s*/g, "$1")
      .replace(/\s*;\s*$/, "")
      .trim()
      .toLowerCase();
    output.set(`${kind}:${name}`, normalized);
  }
  return output;
}

describe("module-owned D1 migrations", () => {
  it("discovers migrations from module-owned directories in Wrangler config", async () => {
    const config = await readFile(resolve("wrangler.toml"), "utf8");
    expect(config).toContain('migrations_dir = "src/modules"');
    expect(config).toContain(
      'migrations_pattern = "src/modules/*/infrastructure/persistence/d1/migrations/*.sql"',
    );

    const paths = (await walk(modulesRoot))
      .map((path) => relative(modulesRoot, path).split(sep).join("/"))
      .filter((path) =>
        /^(identity|files|quota|sharing)\/infrastructure\/persistence\/d1\/migrations\/\d+.*\.sql$/i.test(
          path,
        ),
      )
      .sort();

    expect(paths).toEqual([
      "files/infrastructure/persistence/d1/migrations/0001_files_initial.sql",
      "files/infrastructure/persistence/d1/migrations/0002_files_catalog_names.sql",
      "files/infrastructure/persistence/d1/migrations/0003_files_transfers.sql",
      "files/infrastructure/persistence/d1/migrations/0004_files_multipart_uploads.sql",
      "files/infrastructure/persistence/d1/migrations/0005_files_recent_activity.sql",
      "files/infrastructure/persistence/d1/migrations/0006_files_favorites.sql",
      "identity/infrastructure/persistence/d1/migrations/0001_identity_initial.sql",
      "identity/infrastructure/persistence/d1/migrations/0002_identity_auth_attempts.sql",
    ]);
  });

  it("keeps every table and index with its module and preserves the legacy schema exactly", async () => {
    const paths = (await walk(modulesRoot))
      .map((path) => ({
        absolutePath: path,
        relativePath: relative(modulesRoot, path).split(sep).join("/"),
      }))
      .filter(({ relativePath }) =>
        /^(identity|files)\/infrastructure\/persistence\/d1\/migrations\/\d+.*\.sql$/i.test(
          relativePath,
        ),
      );
    const allActiveDefinitions = new Map<string, string>();
    const initialDefinitions = new Map<string, string>();

    for (const { absolutePath, relativePath } of paths) {
      const owner = relativePath.split("/")[0];
      const moduleDefinitions = definitions(
        await readFile(absolutePath, "utf8"),
      );
      for (const [key, value] of moduleDefinitions) {
        const name = key.slice(key.indexOf(":") + 1);
        expect(name.startsWith(`${owner}_`)).toBe(true);
        expect(allActiveDefinitions.has(key)).toBe(false);
        allActiveDefinitions.set(key, value);

        // The initial module migrations must reproduce the legacy schema
        // exactly. Later migrations are additive and may define new objects.
        if (/\/0001_[^/]+\.sql$/i.test(relativePath)) {
          initialDefinitions.set(key, value);
        }
      }
    }

    const legacyDefinitions = definitions(
      await readFile(legacyMigrationPath, "utf8"),
    );
    expect(initialDefinitions.size).toBe(17);
    expect([...initialDefinitions.keys()].sort()).toEqual(
      [...legacyDefinitions.keys()].sort(),
    );
    for (const [key, value] of legacyDefinitions) {
      expect(initialDefinitions.get(key)).toBe(value);
    }

    expect(
      allActiveDefinitions.has(
        "index:files_folders_owner_parent_name_active_idx",
      ),
    ).toBe(true);
    expect(
      allActiveDefinitions.has(
        "index:files_items_owner_folder_name_active_idx",
      ),
    ).toBe(true);
    expect(allActiveDefinitions.has("table:files_catalog_names")).toBe(true);
    expect(allActiveDefinitions.has("table:identity_auth_attempts")).toBe(true);
    expect(
      allActiveDefinitions.has("index:identity_auth_attempts_locked_until_idx"),
    ).toBe(true);
  });

  it("documents the module migration order and retains the legacy migration", async () => {
    const manifest = await readFile(resolve("migrations/manifest.md"), "utf8");
    expect(manifest).toContain(
      "files/infrastructure/persistence/d1/migrations/0001_files_initial.sql",
    );
    expect(manifest).toContain(
      "files/infrastructure/persistence/d1/migrations/0002_files_catalog_names.sql",
    );
    expect(manifest).toContain(
      "files/infrastructure/persistence/d1/migrations/0003_files_transfers.sql",
    );
    expect(manifest).toContain(
      "files/infrastructure/persistence/d1/migrations/0005_files_recent_activity.sql",
    );
    expect(manifest).toContain(
      "files/infrastructure/persistence/d1/migrations/0006_files_favorites.sql",
    );
    expect(manifest).toContain(
      "identity/infrastructure/persistence/d1/migrations/0001_identity_initial.sql",
    );
    expect(manifest).toContain("migrations/0001_initial_schema.sql");
  });
});
