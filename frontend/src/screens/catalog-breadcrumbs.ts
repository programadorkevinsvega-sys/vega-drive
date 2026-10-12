import type { Crumb } from "../ui/Breadcrumbs";
import type { CatalogView } from "./useCatalogData";

interface BreadcrumbFolder {
  id: string | null;
  name: string;
}

export function buildCatalogBreadcrumbs(
  view: CatalogView,
  folderId: string | null,
  breadcrumbs: BreadcrumbFolder[] | undefined,
): Crumb[] {
  if (view === "trash") return [{ label: "Mi unidad", href: "#/drive" }];
  if (folderId === null) return [];

  return (breadcrumbs ?? []).map((crumb) => ({
    label: crumb.id === null ? "Mi unidad" : crumb.name,
    href: crumb.id === null ? "#/drive" : "#/drive/folder/" + crumb.id,
  }));
}
