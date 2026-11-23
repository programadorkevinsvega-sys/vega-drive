import { readFile } from "node:fs/promises";
import {
  absolute,
  relativePath,
  runGuard,
  sourceFiles,
  walk,
} from "./guard-utils.mjs";

await runGuard("Composition root y gateways de módulos", async (failures) => {
  const files = await sourceFiles();
  const contents = new Map();
  for (const file of files)
    contents.set(relativePath(file), await readFile(file, "utf8"));

  const root = contents.get("src/worker/composition-root.ts") ?? "";
  if (!root)
    failures.push(
      "Debe existir el composition root en src/worker/composition-root.ts.",
    );

  for (const [name, api] of [
    ["Identity", "IdentityPublicApi"],
    ["Files", "FilesPublicApi"],
  ]) {
    if (
      !new RegExp(
        "export\\s+interface\\s+" + name + "Gateway\\s+extends\\s+" + api,
      ).test(root)
    )
      failures.push(
        name + "Gateway debe extender el contrato público " + api + ".",
      );
    if (
      !new RegExp(
        "export\\s+class\\s+InProcess" +
          name +
          "Gateway\\s+implements\\s+" +
          name +
          "Gateway",
      ).test(root)
    )
      failures.push("Falta el adaptador InProcess" + name + "Gateway.");
  }

  for (const name of ["Quota", "Sharing"]) {
    const api = name + "PublicApi";
    const gateway = name + "Gateway";
    if (!new RegExp("export\\s+interface\\s+" + gateway).test(root))
      failures.push("Falta el contrato explícito " + gateway + ".");
    if (
      !new RegExp(
        "export\\s+class\\s+InProcess" +
          name +
          "Gateway\\s+implements\\s+" +
          gateway,
      ).test(root)
    )
      failures.push(
        "Falta el adaptador placeholder InProcess" + name + "Gateway.",
      );
    const unavailable = new RegExp(
      "const\\s+" +
        name.toLowerCase() +
        "Api\\s*:\\s*" +
        api +
        "\\s*=\\s*\\{\\s*status\\s*:\\s*\\(\\)\\s*=>\\s*\\(\\{\\s*module:\\s*['\"]" +
        name.toLowerCase() +
        "['\"],\\s*ready:\\s*false",
    );
    if (!unavailable.test(root))
      failures.push(
        name +
          " debe permanecer explícitamente ready: false y sin capacidades ficticias.",
      );
  }

  const bffFiles = await walk(absolute("src/bff"), /[.](?:ts|tsx|js|mjs)$/i);
  for (const file of bffFiles) {
    const rel = relativePath(file);
    const source = await readFile(file, "utf8");
    if (source.includes("from ") && source.includes("/modules/"))
      failures.push(
        rel + " importa módulos directamente en vez de consumir gateways.",
      );
    if (
      ["VEGA_DRIVE_DB", "FILES_BUCKET", "D1Database", "R2Bucket"].some(
        (token) => source.includes(token),
      )
    )
      failures.push(rel + " accede directamente a infraestructura.");
  }

  const worker = contents.get("src/worker/index.ts") ?? "";
  if (worker.split("createCompositionRoot(").length - 1 !== 1)
    failures.push(
      "El Worker debe resolver sus dependencias mediante un único composition root.",
    );

  const previewDoc = await readFile(absolute("FILES_PREVIEW.md"), "utf8");
  if (
    !/same-origin/i.test(previewDoc) ||
    !/no necesita.*CORS/i.test(previewDoc)
  )
    failures.push(
      "FILES_PREVIEW.md debe documentar que el preview same-origin no necesita CORS de R2.",
    );
  if (previewDoc.includes("Access-Control-Allow-Origin: *"))
    failures.push(
      "La documentación de preview no debe recomendar CORS wildcard.",
    );
});
