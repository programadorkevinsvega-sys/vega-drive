import type { ReactNode } from "react";
import { routeMeta } from "../router/route-meta";
import type { Route } from "../router/routes";
import { NotFoundScreen } from "./NotFoundScreen";
import { ScreenPlaceholder } from "./ScreenPlaceholder";
import { PasswordSettingsScreen } from "./PasswordSettingsScreen";
import { FilesCatalogScreen } from "./FilesCatalogScreen";
import { RecentFilesScreen } from "./RecentFilesScreen";
import { FavoritesScreen } from "./FavoritesScreen";

const DRIVE_HOME = { label: "Mi unidad", href: "#/drive" };

/** Tabla ruta -> pantalla, con el catálogo real conectado al BFF. */
export function renderScreen(route: Route): ReactNode {
  const title = routeMeta(route).title;
  switch (route.name) {
    case "not-found":
      return <NotFoundScreen />;
    case "drive":
      return <FilesCatalogScreen view="drive" folderId={route.folderId} />;
    case "trash":
      return <FilesCatalogScreen view="trash" folderId={null} />;
    case "recent":
      return <RecentFilesScreen />;
    case "favorites":
      return <FavoritesScreen />;
    case "search":
      return (
        <ScreenPlaceholder
          icon="search"
          title={title}
          crumbs={[DRIVE_HOME, { label: title }]}
          delivery="Entrega 5"
          description="La búsqueda sobre el catálogo llegará en una entrega posterior."
        />
      );
    case "settings":
      return <PasswordSettingsScreen />;
    case "login":
    case "register":
      return null;
  }
}
