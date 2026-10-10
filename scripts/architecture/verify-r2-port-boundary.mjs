import { relative, sep } from "node:path";
import { absolute, relativePath, runGuard, sourceFiles } from "./guard-utils.mjs";
import { readFile } from "node:fs/promises";

await runGuard("Frontera de R2 e IFileStoragePort", async (failures, notes) => {
  const files = await sourceFiles();
  let portFound = false;
  let adapterFound = false;
  for (const file of files) {
    const rel = relativePath(file);
    const source = await readFile(file, "utf8");
    if (/\binterface\s+IFileStoragePort\b/.test(source) || /\btype\s+IFileStoragePort\b/.test(source)) portFound = true;
    if (/src\/modules\/files\/infrastructure\/storage\/r2\//.test(rel)) adapterFound = true;
    const usesBinding = /\bFILES_BUCKET\b|\bR2Bucket\b|from\s*[\"'][^\"']*cloudflare[^\"']*[\"']/i.test(source);
    const allowedEnvDeclaration = rel === "src/worker/env.ts" && /\bFILES_BUCKET\s*:\s*R2Bucket/.test(source);
    const allowedR2Adapter = rel.startsWith("src/modules/files/infrastructure/storage/r2/");
    if (usesBinding && !allowedEnvDeclaration && !allowedR2Adapter) {
      failures.push(rel + ": binding/tipo R2 usado fuera del adaptador autorizado de files.");
    }
  }
  if (!portFound) notes.push("IFileStoragePort aún no está implementado; no se certifica el acceso funcional a R2 hasta que exista.");
  if (portFound && !adapterFound) failures.push("Existe IFileStoragePort pero no se encontró el adaptador R2 en files/infrastructure/storage/r2.");
});
