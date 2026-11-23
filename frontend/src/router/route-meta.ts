import type { Route } from "./routes";

export type Layout = "shell" | "auth" | "public";

export interface RouteMeta {
  title: string;
  layout: Layout;
}

export function routeMeta(route: Route): RouteMeta {
  switch (route.name) {
    case "login":
      return { title: "Iniciar sesión", layout: "auth" };
    case "register":
      return { title: "Crear cuenta", layout: "auth" };
    case "drive":
      return { title: "Mi unidad", layout: "shell" };
    case "recent":
      return { title: "Recientes", layout: "shell" };
    case "favorites":
      return { title: "Favoritos", layout: "shell" };
    case "trash":
      return { title: "Papelera", layout: "shell" };
    case "search":
      return { title: "Búsqueda", layout: "shell" };
    case "settings":
      return { title: "Ajustes", layout: "shell" };
    case "not-found":
      return { title: "Página no encontrada", layout: "shell" };
  }
}
