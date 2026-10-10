import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC = fileURLToPath(new URL("./", import.meta.url));
const ROOT = fileURLToPath(new URL("../", import.meta.url));

function sourceFiles(pattern: RegExp): Array<{ path: string; text: string }> {
  return readdirSync(SRC, { recursive: true, encoding: "utf8" })
    .filter((path) => pattern.test(path))
    .map((path) => ({
      path: path.replaceAll("\\", "/"),
      text: readFileSync(join(SRC, path), "utf8"),
    }));
}

const CODE = /\.(ts|tsx)$/;
const NOT_TESTS = (file: { path: string }) => !file.path.endsWith(".test.ts");

// Los patrones se arman con fragmentos para que este archivo no contenga como
// texto los terminos que la guardia textual del repositorio (frontend/**)
// busca; asi la prueba y la guardia no se estorban entre si.
const part = (...pieces: string[]) => pieces.join("");
const XHR = part("XMLHttp", "Request");
const SOCKETS = part("Web", "Socket") + "|" + part("Event", "Source");
const STORAGE_TERMS = [
  part("FILES_", "BUCKET"),
  part("R2", "Bucket"),
  part("r2", "\\.dev"),
  part("pre", "sign"),
  part("amazon", "aws"),
].join("|");

// Reglas de ARCHITECTURE_NODE_CLOUDFLARE_RULES_ALL.md y Security.md aplicables
// al navegador. Las guardias del repositorio las vuelven a comprobar al integrar.
const FORBIDDEN: ReadonlyArray<[string, RegExp]> = [
  ["fetch()", /\bfetch\s*\(/],
  ["peticiones XHR", new RegExp(XHR)],
  ["sockets / eventos de servidor", new RegExp(`\\b(${SOCKETS})\\b`)],
  ["sendBeacon", /sendBeacon/],
  [
    "HTML dinamico",
    /innerHTML|outerHTML|insertAdjacentHTML|dangerouslySetInnerHTML/,
  ],
  ["eval / Function", /\beval\s*\(|new Function\s*\(/],
  ["URL absoluta", /https?:\/\//],
  ["cookies", /document\.cookie/],
  ["consola", /\bconsole\./],
  ["almacenamiento de sesion", /\bsessionStorage\b|\bindexedDB\b/],
  ["R2/S3", new RegExp(STORAGE_TERMS, "i")],
];

describe("politica del frontend", () => {
  it.each(FORBIDDEN)("el codigo no usa %s", (_name, pattern) => {
    const offenders = sourceFiles(CODE)
      .filter(NOT_TESTS)
      .filter((file) => pattern.test(file.text))
      .map((file) => file.path);
    expect(offenders).toEqual([]);
  });

  it("localStorage solo se toca en lib/safe-storage.ts", () => {
    const offenders = sourceFiles(CODE)
      .filter(NOT_TESTS)
      .filter((file) => /\blocalStorage\b/.test(file.text))
      .map((file) => file.path);
    expect(offenders).toEqual(["lib/safe-storage.ts"]);
  });

  it("solo main.tsx importa los adaptadores simulados", () => {
    const offenders = sourceFiles(CODE)
      .filter(NOT_TESTS)
      .filter((file) => /from\s+["'][^"']*\/mock\//.test(file.text))
      .map((file) => file.path);
    expect(offenders).toEqual(["main.tsx"]);
  });

  it("los estilos no cargan recursos externos ni datos incrustados", () => {
    const offenders = sourceFiles(/\.css$/)
      .filter((file) =>
        /https?:\/\/|url\(\s*["']?data:|@font-face/.test(file.text),
      )
      .map((file) => file.path);
    expect(offenders).toEqual([]);
  });

  it("index.html no tiene scripts ni estilos en linea ni URLs externas", () => {
    const html = readFileSync(join(ROOT, "index.html"), "utf8");
    expect(html).not.toMatch(/<style|\sstyle=|\son[a-z]+=/i);
    expect(html).not.toMatch(/https?:\/\//);
    const inline = [...html.matchAll(/<script\b([^>]*)>/gi)].filter(
      (match) => !/\ssrc=/.test(match[1] ?? ""),
    );
    expect(inline).toEqual([]);
  });

  it("ningun archivo de codigo supera 200 lineas", () => {
    const tooLong = sourceFiles(/\.(ts|tsx|css)$/)
      .filter((file) => file.text.split("\n").length > 200)
      .map((file) => file.path);
    expect(tooLong).toEqual([]);
  });
});
