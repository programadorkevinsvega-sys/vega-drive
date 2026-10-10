import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import process from "node:process";
const root = process.cwd();
const modulesRoot = join(root, "src", "modules");
const names = ["identity", "files", "quota", "sharing"];
const failures = [];
async function walk(dir) {
  let entries;
  try { entries = await readdir(dir, { withFileTypes: true }); } catch { return []; }
  const paths = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) paths.push(...await walk(path));
    else if (/\.(ts|tsx|js|mjs|sql)$/i.test(entry.name)) paths.push(path);
  }
  return paths;
}
const files = await walk(modulesRoot);
for (const file of files) {
  const rel = relative(root, file).replaceAll("\\", "/");
  const owner = names.find((name) => rel.startsWith("src/modules/" + name + "/"));
  if (!owner) continue;
  const source = await readFile(file, "utf8");
  for (const other of names.filter((name) => name !== owner)) {
    const internalImport = new RegExp("(?:from\\s*|import\\s*\\()\\s*[\"'][^\"']*modules/" + other + "/(?:domain|application|infrastructure|repositories|persistence)/", "i");
    if (internalImport.test(source)) failures.push(rel + ": import interno de " + other);
    if (/\b(?:SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)\b/i.test(source) && new RegExp("\\b" + other + "_\\w+\\b", "i").test(source)) failures.push(rel + ": SQL/referencia a prefijo ajeno " + other + "_");
  }
  if (/\bJOIN\b/i.test(source)) failures.push(rel + ": JOIN no permitido en módulos");
  if (/\bFOREIGN\s+KEY\b|\bREFERENCES\s+[a-z]+_/i.test(source)) failures.push(rel + ": FK no permitida en módulos");
  if (/\.batch\s*\(/i.test(source)) failures.push(rel + ": db.batch() requiere revisión explícita");
}
if (failures.length) {
  console.error("Falló la verificación de fronteras arquitectónicas:");
  for (const failure of failures) console.error(" - " + failure);
  process.exitCode = 1;
} else console.log("Fronteras arquitectónicas OK (" + files.length + " archivos de módulos inspeccionados).");
