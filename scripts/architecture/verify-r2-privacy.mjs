import { readFile } from "node:fs/promises";
import { absolute, relativePath, runGuard, sourceFiles } from "./guard-utils.mjs";

await runGuard("Privacidad de R2 en el código y configuración versionada", async (failures, notes) => {
  const files = await sourceFiles();
  for (const file of files) {
    const rel = relativePath(file);
    const source = await readFile(file, "utf8");
    if (/https?:\/\/[^\s\"'<>]*(?:r2\.dev|r2\.cloudflarestorage\.com|amazonaws\.com|s3[.-])/i.test(source)) failures.push(rel + ": URL pública/externalizada de R2/S3.");
    if (/\b(?:getSignedUrl|createPresignedRequest|presign(?:ed)?Url|presignedUrl)\b/i.test(source)) failures.push(rel + ": generación/uso de URL prefirmada no permitida.");
    if (/\b(?:publicBucket|public_access|allow_public_access)\s*[:=]\s*(?:true|1)/i.test(source)) failures.push(rel + ": configuración de almacenamiento marcada como pública.");
  }
  const config = await readFile(absolute("wrangler.toml"), "utf8").catch(() => "");
  if (!/\[\[r2_buckets\]\][\s\S]*?binding\s*=\s*[\"']FILES_BUCKET[\"']/.test(config)) failures.push("wrangler.toml no declara el binding esperado FILES_BUCKET.");
  notes.push("El estado público/privado real de Cloudflare no se consulta aquí; el bucket fue verificado manualmente por el propietario.");
});
