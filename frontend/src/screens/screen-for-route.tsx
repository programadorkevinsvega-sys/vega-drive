import type { ReactNode } from "react";
import { routeMeta } from "../router/route-meta";
import type { Route } from "../router/routes";
import { KitScreen } from "./kit/KitScreen";
import { NotFoundScreen } from "./NotFoundScreen";
import { ScreenPlaceholder } from "./ScreenPlaceholder";

const DRIVE_HOME = { label: "Mi unidad", href: "#/drive" };

/** Tabla ruta -> pantalla. Las pantallas reales sustituiran a los marcadores. */
export function renderScreen(route: Route): ReactNode {
  const title = routeMeta(route).title;
  switch (route.name) {
    case "kit":
      return <KitScreen />;
    case "not-found":
      return <NotFoundScreen />;
    case "drive":
      return (
        <ScreenPlaceholder
          icon="folder"
          title={route.folderId ? "Carpeta" : title}
          crumbs={
            route.folderId
              ? [DRIVE_HOME, { label: "Carpeta" }]
              : [{ label: title }]
          }
          delivery="Entrega 3"
          description="El explorador de archivos y carpetas, con datos simulados, llega en la Entrega 3."
        />
      );
    case "recent":
    case "favorites":
    case "trash":
      return (
        <ScreenPlaceholder
          icon={
            route.name === "recent"
              ? "clock"
              : route.name === "trash"
                ? "trash"
                : "star"
          }
          title={title}
          crumbs={[DRIVE_HOME, { label: title }]}
          delivery="Entrega 3"
          description="Esta vista usará los mismos componentes del dashboard con datos simulados."
        />
      );
    case "search":
      return (
        <ScreenPlaceholder
          icon="search"
          title={title}
          crumbs={[DRIVE_HOME, { label: title }]}
          delivery="Entrega 5"
          description="La búsqueda local sobre datos simulados llega en la Entrega 5."
        />
      );
    case "settings":
      return (
        <ScreenPlaceholder
          icon="settings"
          title={title}
          crumbs={[DRIVE_HOME, { label: title }]}
          delivery="Entrega 5"
          description="Perfil simulado, tema y preferencias de vista llegan en la Entrega 5."
        />
      );
    case "login":
    case "register":
      return null;
  }
}
