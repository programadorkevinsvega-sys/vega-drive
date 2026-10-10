import { readFile, readdir } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";

const databaseName = process.env.D1_DATABASE_NAME ?? "vega_drive_db";
const customMigrationsDirectory = process.env.D1_MIGRATIONS_DIR;
const migrationsDirectory = resolve(customMigrationsDirectory ?? "src/modules");
const moduleMigrationPattern =
  /^(identity|files|quota|sharing)\/infrastructure\/persistence\/d1\/migrations\/\d+.*\.sql$/i;

async function walk(directory) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    return [];
  }
  const files = [];
  for (const entry of entries) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(path)));
    else if (entry.isFile() && entry.name.endsWith(".sql")) files.push(path);
  }
  return files;
}
const wranglerCommand = process.env.WRANGLER_COMMAND ?? "pnpm";
const wranglerArgs =
  wranglerCommand === "pnpm"
    ? ["exec", "wrangler", "d1", "execute", databaseName, "--remote", "--json"]
    : ["d1", "execute", databaseName, "--remote", "--json"];

function normalizeSql(sql) {
  return sql
    .replace(/\bIF\s+NOT\s+EXISTS\b/gi, "")
    .replace(/\s+/g, " ")
    .replace(/\s*([(),])\s*/g, "$1")
    .replace(/\s*;\s*$/, "")
    .trim()
    .toLowerCase();
}

function parseExpectedSchema(sql, filename) {
  const statements = sql
    .replace(/^\s*--.*$/gm, "")
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean);
  const expected = new Map();

  for (const statement of statements) {
    const match = statement.match(
      /^CREATE\s+(TABLE|(?:UNIQUE\s+)?INDEX)\s+(?:IF\s+NOT\s+EXISTS\s+)?(["'\x60]?)([\w]+)\2/i,
    );
    if (!match) {
      throw new Error(
        `Unsupported DDL in ${filename}: ${statement.slice(0, 100)}. Update the schema verifier before adding ALTER/DROP/other DDL.`,
      );
    }

    const kind = /^TABLE$/i.test(match[1]) ? "table" : "index";
    const name = match[3];
    if (kind === "index" && /^sqlite_/i.test(name)) continue;
    expected.set(`${kind}:${name}`, normalizeSql(statement));
  }

  return expected;
}

function parseWranglerJson(output) {
  const candidates = [output.indexOf("["), output.indexOf("{")]
    .filter((index) => index >= 0)
    .sort((a, b) => a - b);
  for (const start of candidates) {
    try {
      const parsed = JSON.parse(output.slice(start));
      const entries = Array.isArray(parsed) ? parsed : [parsed];
      const rows = entries.flatMap((entry) => {
        if (Array.isArray(entry?.results)) return entry.results;
        if (Array.isArray(entry?.result?.results)) return entry.result.results;
        return [];
      });
      if (rows.length || entries.some((entry) => entry?.success === true)) {
        return rows;
      }
    } catch {
      // Try the next possible JSON start in Wrangler's human-readable output.
    }
  }
  throw new Error(
    `Could not parse Wrangler JSON output. First 500 characters: ${output.slice(0, 500)}`,
  );
}

const files = (await walk(migrationsDirectory))
  .map((absolutePath) => ({
    absolutePath,
    relativePath: relative(migrationsDirectory, absolutePath)
      .split(sep)
      .join("/"),
  }))
  .filter(({ absolutePath, relativePath }) => {
    if (!/\.sql$/i.test(absolutePath)) return false;
    if (customMigrationsDirectory) {
      return /^\d+.*\.sql$/i.test(relativePath.split("/").at(-1) ?? "");
    }
    return moduleMigrationPattern.test(relativePath);
  })
  .sort((a, b) => a.relativePath.localeCompare(b.relativePath, "en"));

if (files.length === 0) {
  throw new Error(`No SQL module migrations found in ${migrationsDirectory}`);
}

const expected = new Map();
for (const { absolutePath, relativePath } of files) {
  const sql = await readFile(absolutePath, "utf8");
  for (const [key, value] of parseExpectedSchema(sql, relativePath)) {
    expected.set(key, value);
  }
}

const query =
  "SELECT type, name, sql FROM sqlite_schema " +
  "WHERE type IN ('table', 'index') AND name NOT LIKE 'sqlite_%' " +
  "ORDER BY type, name";
const result = spawnSync(
  wranglerCommand,
  [...wranglerArgs, "--command", query],
  { encoding: "utf8", maxBuffer: 5 * 1024 * 1024 },
);

if (result.error) throw result.error;
if (result.status !== 0) {
  throw new Error(
    `Unable to inspect remote D1 schema (exit ${result.status}): ${(result.stderr || result.stdout).slice(0, 1000)}`,
  );
}

const rows = parseWranglerJson(result.stdout);
// Cloudflare/Wrangler-managed tables are not part of the application schema.
const internalTables = new Set(["_cf_KV", "d1_migrations"]);
const actual = new Map(
  rows
    .filter(
      (row) =>
        (row.type === "table" || row.type === "index") &&
        typeof row.name === "string" &&
        !internalTables.has(row.name) &&
        typeof row.sql === "string",
    )
    .map((row) => [`${row.type}:${row.name}`, normalizeSql(row.sql)]),
);

const missing = [];
const mismatched = [];
const unexpected = [];

for (const [key, sql] of expected) {
  if (!actual.has(key)) missing.push(key);
  else if (actual.get(key) !== sql) mismatched.push(key);
}
for (const key of actual.keys()) {
  if (!expected.has(key)) unexpected.push(key);
}

if (missing.length || mismatched.length || unexpected.length) {
  console.error("D1 structural verification FAILED.");
  if (missing.length) console.error(`Missing objects: ${missing.join(", ")}`);
  if (mismatched.length)
    console.error(`Incompatible definitions: ${mismatched.join(", ")}`);
  if (unexpected.length)
    console.error(`Unexpected objects: ${unexpected.join(", ")}`);
  console.error(
    "Deployment must stop. Reconcile the remote schema or update the migration/verifier intentionally.",
  );
  process.exitCode = 1;
} else {
  console.log(
    `D1 structural verification passed: ${expected.size} tables/indexes match migrations in ${databaseName}.`,
  );
}
