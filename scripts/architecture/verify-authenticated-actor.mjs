import { readFile } from "node:fs/promises";
import { absolute, relativePath, runGuard, sourceFiles, walk } from "./guard-utils.mjs";

await runGuard("Origen confiable de AuthenticatedActor", async (failures, notes) => {
  const files = await sourceFiles();
  let actorFound = false;
  for (const file of files) {
    const rel = relativePath(file);
    const source = await readFile(file, "utf8");
    if (/\b(?:interface|type|class)\s+AuthenticatedActor\b/.test(source)) actorFound = true;
    const isController = /src\/bff\/(?:controllers|routes)\//.test(rel);
    if (isController && /(?:body|payload|input|json)\s*\.\s*(?:ownerId|userId|role|roles|permissions|isAdmin)\b/i.test(source)) {
      failures.push(rel + ": el controlador usa ownerId/rol/permisos del navegador como fuente de autorización.");
    }
    if (/\bAuthenticatedActor\b/.test(source) && /\b(?:ownerId|userId|role|permissions)\s*:\s*(?:body|payload|input|json)\./i.test(source)) {
      failures.push(rel + ": AuthenticatedActor se construye desde datos de la petición.");
    }
    if (/\bnew\s+AuthenticatedActor\s*\(/.test(source)) failures.push(rel + ": AuthenticatedActor no debe construirse directamente con new.");
    if (/\bAuthenticatedActor\b/.test(source) && /src\/bff\/(?:controllers|routes)\//.test(rel) && !/from\s*[\"'][^\"']*(?:actor|session|gateway)[^\"']*[\"']/i.test(source)) {
      notes.push(rel + ": revisar manualmente que el actor provenga del resolver de sesión del servidor.");
    }
  }
  if (!actorFound) notes.push("AuthenticatedActor aún no está implementado; la guardia se activa al aparecer y no certifica flujos de autenticación inexistentes.");
});
