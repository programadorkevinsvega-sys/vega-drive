import { readFile } from "node:fs/promises";
import { frontendFiles, relativePath, runGuard } from "./guard-utils.mjs";

await runGuard("Frontera del frontend", async (failures, notes) => {
  const files = await frontendFiles();
  if (files.length === 0)
    notes.push(
      "No se encontraron assets fuente de frontend en public/ o frontend/.",
    );
  for (const file of files) {
    const rel = relativePath(file);
    const source = await readFile(file, "utf8");
    if (
      /\b(?:FILES_BUCKET|R2Bucket|AWS_ACCESS_KEY_ID|AWS_SECRET_ACCESS_KEY)\b/i.test(
        source,
      )
    )
      failures.push(rel + ": contiene binding/credenciales de almacenamiento.");
    if (
      /https?:\/\/[^\s\"'<>]*(?:r2\.dev|r2\.cloudflarestorage\.com|amazonaws\.com|s3[.-])/i.test(
        source,
      )
    )
      failures.push(rel + ": URL directa de R2/S3 en frontend.");
    if (
      /\b(?:getSignedUrl|createPresignedRequest|presign(?:ed)?Url|S3Client|R2Client)\b/i.test(
        source,
      )
    )
      failures.push(
        rel + ": SDK o API de acceso directo/presignado a almacenamiento.",
      );
    const fetchPattern = /\bfetch\s*\(\s*([`'\"])(.*?)\1/gs;
    for (const match of source.matchAll(fetchPattern)) {
      const target = match[2] ?? "";
      if (
        /^(?:https?:)?\/\//i.test(target) ||
        (!target.startsWith("/api/") &&
          !target.startsWith("/api?") &&
          target !== "/api")
      ) {
        failures.push(
          rel +
            ": fetch() debe apuntar a una ruta del mismo origen bajo /api (encontrado: " +
            target.slice(0, 80) +
            ").",
        );
      }
    }
    if (/\bXMLHttpRequest\b|\bWebSocket\s*\(/.test(source))
      failures.push(
        rel +
          ": transporte alternativo detectado; revisar que solo use la API /api.",
      );
  }
});
