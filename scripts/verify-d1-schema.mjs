import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";

const databaseName = process.env.D1_DATABASE_NAME ?? "vega_drive_db";
const migrationsDirectory = resolve(
  process.env.D1_MIGRATIONS_DIR ?? "migrations",
);
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

const files = (await readdir(migrationsDirectory))
  .filter((name) => /^\d+.*\.sql$/i.test(name))
  .sort((a, b) => a.localeCompare(b, "en"));

if (files.length === 0) {
  throw new Error(`No SQL migrations found in ${migrationsDirectory}`);
}

const expected = new Map();
for (const filename of files) {
  const sql = await readFile(resolve(migrationsDirectory, filename), "utf8");
  for (const [key, value] of parseExpectedSchema(sql, filename)) {
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
const actual = new Map(
  rows
    .filter(
      (row) =>
        (row.type === "table" || row.type === "index") &&
        typeof row.name === "string" &&
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
