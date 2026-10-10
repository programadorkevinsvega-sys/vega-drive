import { describe, expect, it } from "vitest";
import { buildHash, MAX_QUERY_LENGTH, parseHash, type Route } from "./routes";

describe("parseHash", () => {
  it("usa Mi unidad como ruta por defecto", () => {
    expect(parseHash("")).toEqual({ name: "drive", folderId: null });
    expect(parseHash("#")).toEqual({ name: "drive", folderId: null });
    expect(parseHash("#/")).toEqual({ name: "drive", folderId: null });
    expect(parseHash("#/drive/")).toEqual({ name: "drive", folderId: null });
  });

  it("reconoce las rutas simples", () => {
    for (const name of [
      "recent",
      "favorites",
      "trash",
      "settings",
      "login",
      "register",
      "kit",
    ] as const) {
      expect(parseHash(`#/${name}`)).toEqual({ name });
    }
  });

  it("acepta carpetas con identificador seguro", () => {
    expect(parseHash("#/drive/folder/abc_123-X")).toEqual({
      name: "drive",
      folderId: "abc_123-X",
    });
  });

  it("rechaza identificadores de carpeta no seguros", () => {
    const bad = [
      "#/drive/folder/..",
      "#/drive/folder/a%2Fb",
      "#/drive/folder/a b",
      "#/drive/folder/<script>",
      `#/drive/folder/${"a".repeat(65)}`,
      "#/drive/folder/",
      "#/drive/folder/a/b",
      "#/drive/other/x",
    ];
    for (const hash of bad) {
      expect(parseHash(hash)).toEqual({ name: "not-found" });
    }
  });

  it("lee, recorta y limita la consulta de busqueda", () => {
    expect(parseHash("#/search?q=%20hola%20mundo%20")).toEqual({
      name: "search",
      query: "hola mundo",
    });
    expect(parseHash("#/search?q=a%26b%3Dc")).toEqual({
      name: "search",
      query: "a&b=c",
    });
    expect(parseHash("#/search")).toEqual({ name: "search", query: "" });
    const long = parseHash(`#/search?q=${"x".repeat(500)}`);
    expect(long).toEqual({ name: "search", query: "x".repeat(MAX_QUERY_LENGTH) });
  });

  it("no falla con codificaciones mal formadas", () => {
    expect(parseHash("#/search?q=%E0%A4%A")).toMatchObject({ name: "search" });
  });

  it("devuelve not-found para rutas desconocidas o con tramos extra", () => {
    for (const hash of ["#/nada", "#/login/extra", "#/__proto__", "#/constructor"]) {
      expect(parseHash(hash)).toEqual({ name: "not-found" });
    }
  });
});

describe("buildHash", () => {
  const routes: Route[] = [
    { name: "login" },
    { name: "register" },
    { name: "drive", folderId: null },
    { name: "drive", folderId: "carpeta-1" },
    { name: "recent" },
    { name: "favorites" },
    { name: "trash" },
    { name: "search", query: "informe & final" },
    { name: "search", query: "" },
    { name: "settings" },
    { name: "kit" },
  ];

  it("es la inversa de parseHash", () => {
    for (const route of routes) {
      expect(parseHash(buildHash(route))).toEqual(route);
    }
  });

  it("codifica la consulta de busqueda", () => {
    expect(buildHash({ name: "search", query: "a b&c" })).toBe(
      "#/search?q=a%20b%26c",
    );
  });
});
