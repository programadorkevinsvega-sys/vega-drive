/** Rutas de la aplicacion. El estado vive en el fragmento (#) de la URL. */
export type Route =
  | { name: "login" }
  | { name: "register" }
  | { name: "drive"; folderId: string | null }
  | { name: "recent" }
  | { name: "favorites" }
  | { name: "trash" }
  | { name: "search"; query: string }
  | { name: "settings" }
  | { name: "kit" }
  | { name: "not-found" };

export type RouteName = Route["name"];

export const DEFAULT_HASH = "#/drive";
export const MAX_QUERY_LENGTH = 200;

/** Identificadores de carpeta aceptados por la interfaz (solo UX, no seguridad). */
const FOLDER_ID = /^[A-Za-z0-9_-]{1,64}$/;

const SIMPLE_ROUTES: Record<string, Route> = {
  recent: { name: "recent" },
  favorites: { name: "favorites" },
  trash: { name: "trash" },
  settings: { name: "settings" },
  login: { name: "login" },
  register: { name: "register" },
  kit: { name: "kit" },
};

export function parseHash(hash: string): Route {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  const queryAt = raw.indexOf("?");
  const path = queryAt === -1 ? raw : raw.slice(0, queryAt);
  const query = queryAt === -1 ? "" : raw.slice(queryAt + 1);
  const segments = path.split("/").filter(Boolean);
  const [first, second, third] = segments;

  if (first === undefined) return { name: "drive", folderId: null };
  if (first === "drive") {
    if (segments.length === 1) return { name: "drive", folderId: null };
    if (second === "folder" && segments.length === 3 && third !== undefined) {
      return FOLDER_ID.test(third)
        ? { name: "drive", folderId: third }
        : { name: "not-found" };
    }
    return { name: "not-found" };
  }
  if (first === "search" && segments.length === 1) {
    const q = new URLSearchParams(query).get("q") ?? "";
    return { name: "search", query: q.trim().slice(0, MAX_QUERY_LENGTH) };
  }
  const simple = Object.hasOwn(SIMPLE_ROUTES, first)
    ? SIMPLE_ROUTES[first]
    : undefined;
  return simple && segments.length === 1 ? simple : { name: "not-found" };
}

export function buildHash(route: Route): string {
  switch (route.name) {
    case "drive":
      return route.folderId ? `#/drive/folder/${route.folderId}` : DEFAULT_HASH;
    case "search":
      return route.query
        ? `#/search?q=${encodeURIComponent(route.query)}`
        : "#/search";
    case "not-found":
      return DEFAULT_HASH;
    default:
      return `#/${route.name}`;
  }
}
