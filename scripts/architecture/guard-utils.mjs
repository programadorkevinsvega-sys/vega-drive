import { readdir, readFile } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import process from "node:process";

export const root = resolve(process.env.VEGA_DRIVE_ROOT ?? process.cwd());
export const moduleNames = ["identity", "files", "quota", "sharing"];
export const toPosix = (path) => path.split(sep).join("/");
export const relativePath = (path) => toPosix(relative(root, path));
export const absolute = (path) => join(root, path);

export async function walk(directory, extensions = /\.(?:ts|tsx|js|mjs|cjs|html|css|sql|json|toml)$/i) {
  let entries;
  try { entries = await readdir(directory, { withFileTypes: true }); }
  catch { return []; }
  const result = [];
  for (const entry of entries) {
    if (["node_modules", ".git", "dist", ".wrangler"].includes(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await walk(path, extensions));
    else if (extensions.test(entry.name)) result.push(path);
  }
  return result;
}

export async function read(path, fallback = "") {
  try { return await readFile(absolute(path), "utf8"); }
  catch { return fallback; }
}

export async function sourceFiles() {
  return walk(absolute("src"), /\.(?:ts|tsx|js|mjs|sql)$/i);
}

export async function frontendFiles() {
  const paths = [
    ...await walk(absolute("public"), /\.(?:js|mjs|html|css|json)$/i),
    ...await walk(absolute("frontend"), /\.(?:js|mjs|ts|tsx|html|css|json)$/i),
  ];
  return [...new Set(paths)];
}

export function moduleFor(path) {
  const rel = typeof path === "string" && path.startsWith(root)
    ? relativePath(path)
    : toPosix(path);
  return moduleNames.find((name) => rel.startsWith("src/modules/" + name + "/")) ?? null;
}

export function fail(failures, message) {
  failures.push(message);
}

export async function runGuard(label, check) {
  const failures = [];
  const notes = [];
  try { await check(failures, notes); }
  catch (error) { failures.push("No se pudo completar la verificación: " + (error instanceof Error ? error.message : String(error))); }
  if (failures.length) {
    console.error("Falló " + label + ":");
    for (const failure of failures) console.error(" - " + failure);
    process.exitCode = 1;
    return;
  }
  console.log(label + " OK.");
  for (const note of notes) console.log(" - NOTA: " + note);
}

export function extractImports(source) {
  const imports = [];
  const pattern = /(?:\bfrom\s*|\bimport\s*(?:\(\s*)?)[\"']([^\"']+)[\"']/g;
  for (const match of source.matchAll(pattern)) if (match[1]) imports.push(match[1]);
  return imports;
}

export function resolveImport(fromFile, specifier) {
  if (!specifier.startsWith(".")) return null;
  const base = resolve(dirname(fromFile), specifier).split(sep).join("/");
  return base.replace(/\.(?:js|mjs|cjs)$/, ".ts");
}

export function sqlText(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/--[^\n]*/g, " ")
    .replace(/(['"`])(?:\\.|(?!\1)[\s\S])*?\1/g, (value) => value);
}
