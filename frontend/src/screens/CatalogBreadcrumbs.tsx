import { Breadcrumbs } from "../ui/Breadcrumbs";
import { buildCatalogBreadcrumbs } from "./catalog-breadcrumbs";
import type { CatalogView } from "./useCatalogData";

interface CatalogBreadcrumbsProps {
  view: CatalogView;
  folderId: string | null;
  breadcrumbs?: Array<{ id: string | null; name: string }>;
}

export function CatalogBreadcrumbs({
  view,
  folderId,
  breadcrumbs,
}: CatalogBreadcrumbsProps) {
  const items = buildCatalogBreadcrumbs(view, folderId, breadcrumbs);
  return items.length ? <Breadcrumbs items={items} /> : null;
}
