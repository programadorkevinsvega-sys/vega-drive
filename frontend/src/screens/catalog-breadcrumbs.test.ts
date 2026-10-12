import { describe, expect, it } from "vitest";
import { buildCatalogBreadcrumbs } from "./catalog-breadcrumbs";

describe("buildCatalogBreadcrumbs", () => {
  it("conserva toda la ruta y permite volver a una carpeta antecesora", () => {
    const crumbs = buildCatalogBreadcrumbs("drive", "bb", [
      { id: null, name: "Mi unidad" },
      { id: "amor", name: "amor" },
      { id: "bb", name: "bb" },
    ]);

    expect(crumbs.map((crumb) => crumb.label)).toEqual([
      "Mi unidad",
      "amor",
      "bb",
    ]);
    expect(crumbs[0]?.href).toBe("#/drive");
    expect(crumbs[1]?.href).toBe("#/drive/folder/amor");
  });

  it("no muestra ruta de carpeta en la raíz de Mi unidad", () => {
    expect(buildCatalogBreadcrumbs("drive", null, [])).toEqual([]);
  });
});
