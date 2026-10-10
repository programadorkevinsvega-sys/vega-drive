import { relative, sep } from "node:path";
import {
  absolute,
  moduleNames,
  read,
  relativePath,
  runGuard,
  walk,
} from "./guard-utils.mjs";

await runGuard("Propiedad modular", async (failures, notes) => {
  const modulesRoot = absolute("src/modules");
  const files = await walk(modulesRoot, /\.(?:ts|tsx|js|mjs|sql)$/i);
  const foundModules = new Set();
  for (const file of files) {
    const rel = relative(modulesRoot, file).split(sep).join("/");
    const owner = rel.split("/")[0];
    if (!moduleNames.includes(owner)) {
      failures.push(
        relativePath(file) + ": archivo fuera de un módulo registrado.",
      );
      continue;
    }
    foundModules.add(owner);
    if (
      rel.endsWith(".sql") &&
      !rel.includes("/infrastructure/persistence/d1/migrations/")
    ) {
      failures.push(
        relativePath(file) +
          ": migración SQL fuera de la infraestructura D1 de su módulo.",
      );
    }
  }

  const migrationsGuard = await read("scripts/check-module-migrations.mjs");
  if (!migrationsGuard)
    failures.push("No existe scripts/check-module-migrations.mjs.");
  else {
    // The dedicated migration guard owns DDL parsing; this guard checks the module layer boundaries.
    for (const name of moduleNames) {
      const api = await read("src/modules/" + name + "/module.public-api.ts");
      if (!api)
        notes.push(
          "La API pública de " +
            name +
            " aún no existe; comprobarlo al implementar ese módulo.",
        );
    }
  }

  for (const name of moduleNames) {
    if (!foundModules.has(name))
      notes.push(
        "El módulo " +
          name +
          " aún no contiene archivos fuente; no se exige implementar fases futuras.",
      );
  }
});
