import { relative, sep } from "node:path";
import { moduleNames, relativePath, runGuard, sourceFiles, walk } from "./guard-utils.mjs";

await runGuard("Límites SQL e imports entre módulos", async (failures) => {
  const files = await sourceFiles();
  const migrations = await walk(process.env.VEGA_DRIVE_ROOT ? process.env.VEGA_DRIVE_ROOT + "/src/modules" : "src/modules", /\.sql$/i);
  const allFiles = [...new Set([...files, ...migrations])];

  for (const file of allFiles) {
    const rel = relativePath(file);
    const owner = moduleNames.find((name) => rel.startsWith("src/modules/" + name + "/"));
    if (!owner) continue;
    const source = await (await import("node:fs/promises")).readFile(file, "utf8");
    const importPattern = /(?:\bfrom\s*|\bimport\s*(?:\(\s*)?)[\"']([^\"']+)[\"']/g;
    for (const match of source.matchAll(importPattern)) {
      const specifier = match[1] ?? "";
      if (!specifier.includes("/modules/")) continue;
      const target = moduleNames.find((name) => specifier.includes("/modules/" + name + "/") || specifier.startsWith("../" + name + "/"));
      if (target && target !== owner && !specifier.endsWith("/module.public-api.js") && !specifier.endsWith("/module.public-api.ts")) {
        failures.push(rel + ": import interno prohibido de " + target + " (" + specifier + ").");
      }
    }

    for (const other of moduleNames.filter((name) => name !== owner)) {
      const foreignPrefix = new RegExp("\\b" + other + "_[a-z][a-z0-9_]*\\b", "i");
      if (/\b(?:SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|REFERENCES|REPLACE)\b/i.test(source) && foreignPrefix.test(source)) {
        failures.push(rel + ": SQL/referencia al prefijo ajeno " + other + "_.");
      }
    }
    if (/\bJOIN\b/i.test(source)) failures.push(rel + ": JOIN prohibido entre límites modulares.");
    if (/\bFOREIGN\s+KEY\b/i.test(source)) failures.push(rel + ": FOREIGN KEY prohibida entre módulos.");
    if (/\b(?:BEGIN\s+(?:TRANSACTION|IMMEDIATE|EXCLUSIVE)|COMMIT\s*;|ROLLBACK\s*;|\.batch\s*\()/i.test(source)) {
      failures.push(rel + ": posible transacción/batch; requiere coordinación explícita dentro de un solo módulo.");
    }
  }
});
