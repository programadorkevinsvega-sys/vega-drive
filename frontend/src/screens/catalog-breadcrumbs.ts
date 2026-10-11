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

  return (breadcrumbs ?? []).slice(0, -1).map((crumb) => ({
    label: crumb.name,
    href: crumb.id === null ? "#/drive" : "#/drive/folder/" + crumb.id,
  }));
}
