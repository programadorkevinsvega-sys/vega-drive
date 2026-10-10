import { relativePath, runGuard, sourceFiles } from "./guard-utils.mjs";
import { readFile } from "node:fs/promises";

await runGuard("Preparación para extracción modular", async (failures, notes) => {
  const files = await sourceFiles();
  let domainCount = 0;
  let applicationCount = 0;
  for (const file of files) {
    const rel = relativePath(file);
    const domain = /\/domain\//.test(rel);
    const application = /\/application\//.test(rel);
    if (!domain && !application) continue;
    const source = await readFile(file, "utf8");
    if (domain) {
      domainCount++;
      if (/from\s*[\"'][^\"']*(?:\/application\/|\/infrastructure\/|\/bff\/|\/worker\/|hono|cloudflare|wrangler)[^\"']*[\"']/i.test(source)) failures.push(rel + ": el dominio depende de una capa externa o infraestructura.");
      if (/\b(?:D1Database|R2Bucket|Hono|ExecutionContext|Fetcher)\b|\b(?:VEGA_DRIVE_DB|FILES_BUCKET)\b/.test(source)) failures.push(rel + ": el dominio contiene tipos/bindings de plataforma.");
    }
    if (application) {
      applicationCount++;
      if (/from\s*[\"'][^\"']*(?:\/infrastructure\/|\/bff\/|\/worker\/|hono|cloudflare|wrangler)[^\"']*[\"']/i.test(source)) failures.push(rel + ": aplicación depende de infraestructura, BFF o plataforma.");
      if (/\b(?:D1Database|D1PreparedStatement|R2Bucket|Hono|ExecutionContext|Fetcher)\b|\b(?:VEGA_DRIVE_DB|FILES_BUCKET)\b/.test(source)) failures.push(rel + ": aplicación expone tipos/bindings concretos de infraestructura.");
    }
  }
  if (!domainCount || !applicationCount) notes.push("Capas domain/application incompletas en esta fase; se validarán automáticamente al incorporarse.");
});
