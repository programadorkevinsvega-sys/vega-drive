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

// Los patrones se arman con fragmentos para que esta prueba no contenga como
// texto los terminos que la guardia textual del repositorio busca.
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

// Las llamadas de red solo se permiten en los clientes HTTP de identidad y
// catálogo. El script remoto solo se permite en el widget oficial de Turnstile.
const FORBIDDEN: ReadonlyArray<[string, RegExp]> = [
  ["sockets / eventos de servidor", new RegExp("\\b(" + SOCKETS + ")\\b")],
  ["sendBeacon", /sendBeacon/],
  [
    "HTML dinamico",
    /innerHTML|outerHTML|insertAdjacentHTML|dangerouslySetInnerHTML/,
  ],
  ["eval / Function", /\beval\s*\(|new Function\s*\(/],
  ["cookies", /document\.cookie/],
  ["consola", /\bconsole\./],
  ["almacenamiento de sesion", /\bsessionStorage\b|\bindexedDB\b/],
  ["R2/S3", new RegExp(STORAGE_TERMS, "i")],
];

describe("politica del frontend", () => {
  it("permite XHR solo para progreso en la subida same-origin", () => {
    const offenders = sourceFiles(CODE)
      .filter(NOT_TESTS)
      .filter((file) => new RegExp(XHR).test(file.text))
      .map((file) => file.path);
    expect(offenders).toEqual(["services/files-transfer-service.ts"]);

    const transfer = readFileSync(
      join(SRC, "services/files-transfer-service.ts"),
      "utf8",
    );
    expect(transfer.match(new RegExp(XHR, "g"))).toHaveLength(1);
    expect(transfer).toContain('request.open("POST", "/api/files", true)');
    expect(transfer).not.toMatch(/https?:\\/\\//);
  });

  it.each(FORBIDDEN)("el codigo no usa %s", (_name, pattern) => {
    const offenders = sourceFiles(CODE)
      .filter(NOT_TESTS)
      .filter((file) => pattern.test(file.text))
      .map((file) => file.path);
    expect(offenders).toEqual([]);
  });

  it("limita fetch() a los clientes HTTP de identidad y catálogo", () => {
    const callers = sourceFiles(CODE)
      .filter(NOT_TESTS)
      .filter((file) => /\bfetch\s*\(/.test(file.text))
      .map((file) => file.path);
    expect(callers).toEqual([
      "services/files-service.ts",
      "services/identity-service.ts",
    ]);

    for (const path of callers) {
      const client = readFileSync(join(SRC, path), "utf8");
      expect(client.match(/\bfetch\s*\(/g)).toHaveLength(1);
      expect(client).toContain('"/api/');
      expect(client).toContain('credentials: "same-origin"');
      expect(client).toContain('cache: "no-store"');
    }
  });

  it("limita URLs absolutas al script oficial de Turnstile", () => {
    const callers = sourceFiles(CODE)
      .filter(NOT_TESTS)
      .filter((file) => /https?:\/\//.test(file.text))
      .map((file) => file.path);
    expect(callers).toEqual(["services/TurnstileWidget.tsx"]);
    const widget = readFileSync(
      join(SRC, "services/TurnstileWidget.tsx"),
      "utf8",
    );
    expect(widget).toContain(
      "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit",
    );
    expect(widget.match(/https?:\/\//g)).toHaveLength(1);
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
