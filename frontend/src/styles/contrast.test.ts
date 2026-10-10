import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

type Tokens = Map<string, string>;

function read(file: string): Tokens {
  const css = readFileSync(new URL(file, import.meta.url), "utf8").replace(
    /\/\*[\s\S]*?\*\//g,
    "",
  );
  const tokens: Tokens = new Map();
  for (const match of css.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    const [, name, value] = match;
    if (name && value) tokens.set(name, value.trim());
  }
  return tokens;
}

function resolve(tokens: Tokens, name: string, depth = 0): string {
  const value = tokens.get(name);
  if (value === undefined || depth > 8) throw new Error(`Sin valor: ${name}`);
  const ref = /^var\((--[\w-]+)\)$/.exec(value);
  return ref?.[1] ? resolve(tokens, ref[1], depth + 1) : value;
}

function luminance(hex: string): number {
  const digits = hex.replace("#", "");
  const full = digits.length === 3 ? [...digits].map((d) => d + d).join("") : digits;
  const [r, g, b] = [0, 2, 4].map((i) => {
    const channel = parseInt(full.slice(i, i + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0);
}

function ratio(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return ((light ?? 0) + 0.05) / ((dark ?? 0) + 0.05);
}

// [primer plano, fondo, minimo]: 4.5 texto, 7 texto principal, 3 elementos de UI.
const PAIRS: ReadonlyArray<[string, string, number]> = [
  ["--vd-text", "--vd-bg", 7],
  ["--vd-text", "--vd-surface", 7],
  ["--vd-text", "--vd-surface-raised", 7],
  ["--vd-text-muted", "--vd-bg", 4.5],
  ["--vd-text-muted", "--vd-surface", 4.5],
  ["--vd-text-muted", "--vd-surface-sunken", 4.5],
  ["--vd-text-muted", "--vd-surface-raised", 4.5],
  ["--vd-text-on-accent", "--vd-accent", 4.5],
  ["--vd-text-on-accent", "--vd-accent-hover", 4.5],
  ["--vd-text-on-accent", "--vd-accent-active", 4.5],
  ["--vd-accent-text", "--vd-surface", 4.5],
  ["--vd-accent-text", "--vd-surface-raised", 4.5],
  ["--vd-accent-text", "--vd-accent-soft", 4.5],
  ["--vd-danger-on-solid", "--vd-danger-solid", 4.5],
  ["--vd-danger-on-solid", "--vd-danger-solid-hover", 4.5],
  ["--vd-danger-text", "--vd-surface", 4.5],
  ["--vd-danger-text", "--vd-surface-raised", 4.5],
  ["--vd-danger-text", "--vd-danger-soft", 4.5],
  ["--vd-success-text", "--vd-surface", 4.5],
  ["--vd-success-text", "--vd-surface-raised", 4.5],
  ["--vd-success-text", "--vd-success-soft", 4.5],
  ["--vd-warning-text", "--vd-warning-soft", 4.5],
  ["--vd-sidebar-fg", "--vd-sidebar-bg", 7],
  ["--vd-sidebar-fg", "--vd-sidebar-hover", 4.5],
  ["--vd-sidebar-muted", "--vd-sidebar-bg", 4.5],
  ["--vd-sidebar-active-fg", "--vd-sidebar-active", 4.5],
  ["--vd-border-strong", "--vd-surface", 3],
  ["--vd-border-strong", "--vd-bg", 3],
  ["--vd-focus", "--vd-surface", 3],
  ["--vd-focus", "--vd-bg", 3],
  ["--vd-vega-300", "--vd-sidebar-bg", 3],
  ["--vd-sidebar-marker", "--vd-sidebar-bg", 3],
  ["--vd-danger-text", "--vd-surface", 3],
];

const light = read("./tokens.css");
const dark = new Map([...light, ...read("./dark.css")]);

describe.each([
  ["claro", light],
  ["oscuro", dark],
] as const)("contraste WCAG en el tema %s", (_theme, tokens) => {
  it.each(PAIRS)("%s sobre %s >= %s:1", (fg, bg, minimum) => {
    const value = ratio(resolve(tokens, fg), resolve(tokens, bg));
    expect(value, `${fg} / ${bg} = ${value.toFixed(2)}`).toBeGreaterThanOrEqual(
      minimum,
    );
  });
});
