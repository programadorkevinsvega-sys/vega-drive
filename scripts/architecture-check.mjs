import { readdir, readFile } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import process from "node:process";

const root = process.cwd();
const srcRoot = join(root, "src");
const names = ["identity", "files", "quota", "sharing"];
const failures = [];
const sourceExtensions = /\.(?:ts|tsx|js|mjs|sql)$/i;

async function walk(dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const paths = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) paths.push(...(await walk(path)));
    else if (sourceExtensions.test(entry.name)) paths.push(path);
  }
  return paths;
}

const sourceFiles = await walk(srcRoot);
const moduleFiles = sourceFiles.filter((file) => {
  const rel = relative(root, file).split(sep).join("/");
  return names.some((name) => rel.startsWith("src/modules/" + name + "/"));
});

for (const file of sourceFiles) {
  const rel = relative(root, file).split(sep).join("/");
  const source = await readFile(file, "utf8");
  const owner = names.find((name) =>
    rel.startsWith("src/modules/" + name + "/"),
  );

  // Code may depend on another module's public API, never its internals.
  const importPattern = /(?:from\s*|import\s*(?:\(\s*)?)["']([^"']+)["']/g;
  for (const match of source.matchAll(importPattern)) {
    const specifier = match[1];
    if (!specifier) continue;
    const resolved = resolve(dirname(file), specifier).split(sep).join("/");
    const target = relative(root, resolved).split(sep).join("/");
    const targetModule = names.find((name) =>
      target.startsWith("src/modules/" + name + "/"),
    );
    if (
      targetModule &&
      targetModule !== owner &&
      !target.endsWith("/module.public-api.js") &&
      !target.endsWith("/module.public-api.ts")
    ) {
      failures.push(
        rel + ": importa interior de " + targetModule + ": " + specifier,
      );
    }
  }

  // R2 belongs to files. The central Worker type declaration is the only exception.
  if (
    /\bFILES_BUCKET\b/.test(source) &&
    rel !== "src/worker/env.ts" &&
    !rel.startsWith("src/modules/files/")
  ) {
    failures.push(rel + ": acceso a FILES_BUCKET fuera de files");
  }

  if (!owner) continue;
  for (const other of names.filter((name) => name !== owner)) {
    const foreignTable = new RegExp("\\b" + other + "_[a-z][a-z0-9_]*\\b", "i");
    if (
      /\b(?:SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|REFERENCES)\b/i.test(
        source,
      ) &&
      foreignTable.test(source)
    ) {
      failures.push(
        rel + ": SQL o referencia al prefijo de otro módulo (" + other + "_)",
      );
    }
  }
  if (/\bJOIN\b/i.test(source))
    failures.push(rel + ": JOIN no permitido en módulos");
  if (/\bFOREIGN\s+KEY\b/i.test(source))
    failures.push(rel + ": FOREIGN KEY no permitida en módulos");
  if (/\.batch\s*\(/i.test(source))
    failures.push(rel + ": db.batch() requiere revisión explícita");
}

if (failures.length) {
  console.error("Falló la verificación de fronteras arquitectónicas:");
  for (const failure of failures) console.error(" - " + failure);
  process.exitCode = 1;
} else {
  console.log(
    "Fronteras arquitectónicas OK (" +
      sourceFiles.length +
      " archivos fuente inspeccionados; " +
      moduleFiles.length +
      " dentro de módulos).",
  );
}
