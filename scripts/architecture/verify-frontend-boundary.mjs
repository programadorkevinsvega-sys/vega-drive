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
    if (!rel.endsWith(".test.ts") && /\bXMLHttpRequest\b/.test(source)) {
      // XHR normally uses same-origin /api targets. A narrow exception permits PUT to a short-lived URL issued by the authenticated direct-transfer API.
      const xhrTargets = [
        ...source.matchAll(
          /\b\w+\.open\(\s*["'](?:GET|POST|PUT|PATCH|DELETE|HEAD)["']\s*,\s*["']([^"']+)["']/g,
        ),
      ].map((match) => match[1] ?? "");
      const signedSingleTransfer =
        rel.endsWith("/files-transfer-direct-single.ts") &&
        source.includes('"/api/files/direct"') &&
        /request\.open\("PUT", started\.url/.test(source);
      const signedMultipartTransfer =
        rel.endsWith("/files-transfer-direct-multipart.ts") &&
        source.includes('"/parts') &&
        source.includes("/url") &&
        /request\.open\("PUT", authorization\.url/.test(source);
      const signedTransferException =
        signedSingleTransfer || signedMultipartTransfer;
      if (
        !signedTransferException &&
        (xhrTargets.length === 0 ||
          xhrTargets.some((target) => !target.startsWith("/api/")))
      ) {
        failures.push(
          rel +
            ": XMLHttpRequest solo se permite para progreso de subida con rutas literales del mismo origen bajo /api.",
        );
      }
    }
    if (/\bWebSocket\s*\(/.test(source))
      failures.push(rel + ": WebSocket no está permitido en el frontend.");
  }
});
