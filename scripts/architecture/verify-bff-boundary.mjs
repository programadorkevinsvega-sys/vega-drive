import { readFile } from "node:fs/promises";
import { absolute, relativePath, runGuard, walk } from "./guard-utils.mjs";

await runGuard("Frontera del BFF", async (failures, notes) => {
  const files = await walk(absolute("src/bff"), /\.(?:ts|tsx|js|mjs)$/i);
  if (!files.length) notes.push("No se encontraron controladores/rutas BFF; se validará la frontera al implementarlos.");
  for (const file of files) {
    const rel = relativePath(file);
    const source = await readFile(file, "utf8");
    const isCompositionRoot = /\/composition-root\.(?:ts|js|mjs)$/.test(rel);
    if (!isCompositionRoot && /from\s*[\"'][^\"']*\/modules\/[^\"']*[\"']/.test(source)) failures.push(rel + ": el BFF solo debe depender de contratos de gateway, no importar módulos directamente.");
    if (!isCompositionRoot && /from\s*[\"'][^\"']*(?:\/domain\/|\/application\/|\/infrastructure\/)[^\"']*[\"']/.test(source)) failures.push(rel + ": controlador/adaptador HTTP importa una capa interna.");
    if (!isCompositionRoot && /\b(?:VEGA_DRIVE_DB|FILES_BUCKET|D1Database|R2Bucket)\b/.test(source)) failures.push(rel + ": controlador BFF accede a infraestructura directamente.");
    if (!isCompositionRoot && /\b(?:SELECT|INSERT\s+INTO|UPDATE\s+\w+\s+SET|DELETE\s+FROM)\b/i.test(source)) failures.push(rel + ": el BFF no debe ejecutar SQL.");
  }
});
