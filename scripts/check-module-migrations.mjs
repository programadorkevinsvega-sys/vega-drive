import { readdir, readFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import process from "node:process";

const root = process.cwd();
const modulesRoot = join(root, "src/modules");
const expectedMigrationsDir = "src/modules";
const expectedMigrationsPattern =
  "src/modules/*/infrastructure/persistence/d1/migrations/*.sql";
const moduleNames = new Set(["identity", "files", "quota", "sharing"]);
const failures = [];

async function walk(directory) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    return [];
  }
  const paths = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) paths.push(...(await walk(path)));
    else if (entry.isFile() && entry.name.toLowerCase().endsWith(".sql")) {
      paths.push(path);
    }
  }
  return paths;
}

const config = await readFile(join(root, "wrangler.toml"), "utf8").catch(
  () => "",
);
if (!config) {
  failures.push("No se encontró wrangler.toml en la raíz del proyecto.");
} else {
  const configuredDir = config.match(
    /^\s*migrations_dir\s*=\s*"([^"]+)"/m,
  )?.[1];
  const configuredPattern = config.match(
    /^\s*migrations_pattern\s*=\s*"([^"]+)"/m,
  )?.[1];
  if (configuredDir !== expectedMigrationsDir) {
    failures.push('migrations_dir debe ser "' + expectedMigrationsDir + '".');
  }
  if (configuredPattern !== expectedMigrationsPattern) {
    failures.push(
      'migrations_pattern debe ser "' + expectedMigrationsPattern + '".',
    );
  }
}

const migrationFiles = (await walk(modulesRoot))
  .map((absolutePath) => ({
    absolutePath,
    relativePath: relative(modulesRoot, absolutePath).split(sep).join("/"),
  }))
  .sort((a, b) => a.relativePath.localeCompare(b.relativePath, "en"));

const validPath =
  /^([a-z]+)\/infrastructure\/persistence\/d1\/migrations\/(\d{4,}_[a-z0-9][a-z0-9_-]*\.sql)$/i;
const migrationsByModule = new Map();

for (const file of migrationFiles) {
  const match = file.relativePath.match(validPath);
  if (!match || !moduleNames.has(match[1])) {
    failures.push(
      file.relativePath +
        ": SQL debe vivir en <módulo>/infrastructure/persistence/d1/migrations/ con nombre numerado.",
    );
    continue;
  }

  const owner = match[1];
  migrationsByModule.set(owner, (migrationsByModule.get(owner) ?? 0) + 1);
  const sql = (await readFile(file.absolutePath, "utf8")).replace(
    /^\s*--.*$/gm,
    "",
  );
  const statements = sql
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean);

  if (statements.length === 0) {
    failures.push(file.relativePath + ": migración vacía.");
    continue;
  }

  for (const statement of statements) {
    const tableMatch = statement.match(
      /^CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(["'\x60]?)([a-z_][a-z0-9_]*)\1(?=\s|\(|$)/i,
    );
    const indexMatch = statement.match(
      /^CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?(["'\x60]?)([a-z_][a-z0-9_]*)\1\s+ON\s+(["'\x60]?)([a-z_][a-z0-9_]*)\3(?=\s|\(|$)/i,
    );

    if (tableMatch) {
      const tableName = tableMatch[2];
      if (!tableName.toLowerCase().startsWith(owner + "_")) {
        failures.push(
          file.relativePath +
            ": la tabla " +
            tableName +
            " no pertenece al módulo " +
            owner +
            ".",
        );
      }
      continue;
    }

    if (indexMatch) {
      const indexName = indexMatch[2];
      const tableName = indexMatch[4];
      if (!indexName.toLowerCase().startsWith(owner + "_")) {
        failures.push(
          file.relativePath +
            ": el índice " +
            indexName +
            " no pertenece al módulo " +
            owner +
            ".",
        );
      }
      if (!tableName.toLowerCase().startsWith(owner + "_")) {
        failures.push(
          file.relativePath +
            ": el índice " +
            indexName +
            " apunta a la tabla ajena " +
            tableName +
            ".",
        );
      }
      continue;
    }

    failures.push(
      file.relativePath +
        ": DDL no reconocido por la guardia de propiedad de migraciones: " +
        statement.slice(0, 100),
    );
  }
}

for (const requiredModule of ["identity", "files"]) {
  if (!migrationsByModule.has(requiredModule)) {
    failures.push(
      "El módulo " +
        requiredModule +
        " debe tener al menos una migración propia.",
    );
  }
}

if (failures.length) {
  console.error("Falló la verificación de propiedad de migraciones D1:");
  for (const failure of failures) console.error(" - " + failure);
  console.error("Despliegue bloqueado antes de ejecutar migraciones remotas.");
  process.exitCode = 1;
} else {
  console.log(
    "Propiedad de migraciones D1 OK (" +
      migrationFiles.length +
      " archivos SQL; tablas e índices dentro del prefijo de su módulo).",
  );
}
