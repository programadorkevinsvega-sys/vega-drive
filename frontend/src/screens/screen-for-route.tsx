import type { ReactNode } from "react";
import type { Route } from "../router/routes";
import { NotFoundScreen } from "./NotFoundScreen";
import { PasswordSettingsScreen } from "./PasswordSettingsScreen";
import { FilesCatalogScreen } from "./FilesCatalogScreen";
import { RecentFilesScreen } from "./RecentFilesScreen";
import { FavoritesScreen } from "./FavoritesScreen";
import { SearchScreen } from "./SearchScreen";\nimport { ShareAccessScreen } from "./ShareAccessScreen";

/** Tabla ruta -> pantalla, con el catálogo real conectado al BFF. */
export function renderScreen(route: Route): ReactNode {
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
      return <SearchScreen initialQuery={route.query} />;
    case "settings":
      return <PasswordSettingsScreen />;
    case "login":
    case "register":
      return null;
  }
}
