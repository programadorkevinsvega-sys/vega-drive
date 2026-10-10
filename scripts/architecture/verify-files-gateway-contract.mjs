import { readFile } from "node:fs/promises";
import {
  absolute,
  relativePath,
  runGuard,
  sourceFiles,
} from "./guard-utils.mjs";

await runGuard(
  "Contrato de FilesGateway y adaptadores intercambiables",
  async (failures, notes) => {
    const files = await sourceFiles();
    const contents = new Map();
    for (const file of files)
      contents.set(relativePath(file), await readFile(file, "utf8"));
    const composition =
      contents.get("src/worker/composition-root.ts") ??
      contents.get("src/bff/composition-root.ts") ??
      "";
    const api = contents.get("src/modules/files/module.public-api.ts") ?? "";
    const gatewayMatch = composition.match(
      /export\s+interface\s+FilesGateway\s*\{([\s\S]*?)\n\}/,
    );
    const adapterMatch = composition.match(
      /export\s+class\s+InProcessFilesGateway\s+implements\s+FilesGateway\s*\{([\s\S]*?)\n\}/,
    );
    if (!gatewayMatch) {
      failures.push("No se encuentra la interfaz FilesGateway exportada.");
      return;
    }
    if (!api)
      failures.push(
        "No se encuentra FilesPublicApi; el gateway debe depender de una API pública estable.",
      );
    const methods = [...gatewayMatch[1].matchAll(/^\s*(\w+)\s*\(/gm)].map(
      (match) => match[1],
    );
    if (!adapterMatch)
      failures.push("InProcessFilesGateway debe implementar FilesGateway.");
    else {
      for (const method of methods)
        if (!new RegExp("\\b" + method + "\\s*\\(").test(adapterMatch[1]))
          failures.push(
            "InProcessFilesGateway no implementa el método " + method + ".",
          );
    }
    for (const [rel, source] of contents) {
      if (
        /ServiceBindingFilesGateway/.test(source) &&
        !/implements\s+FilesGateway/.test(source)
      )
        failures.push(
          rel +
            ": ServiceBindingFilesGateway debe implementar el mismo FilesGateway.",
        );
    }
    if (
      !contents.has("src/bff/gateways/service-binding-files-gateway.ts") &&
      ![...contents.keys()].some((path) =>
        /service-binding-files-gateway\.(?:ts|js)$/.test(path),
      )
    ) {
      notes.push(
        "ServiceBindingFilesGateway no existe todavía; se validará automáticamente al añadirse. No se exige en el monolito actual.",
      );
    }
  },
);
