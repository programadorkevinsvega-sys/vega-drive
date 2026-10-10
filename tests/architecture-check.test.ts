import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
describe("architecture guard", () => {
  it("is wired into lint and checks cross-module boundaries", async () => {
    const pkg = JSON.parse(await readFile(resolve("package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };
    const guard = await readFile(
      resolve("scripts/architecture-check.mjs"),
      "utf8",
    );
    expect(pkg.scripts.lint).toContain("architecture-check.mjs");
    expect(guard).toContain("JOIN");
    expect(guard).toContain("FOREIGN");
    expect(guard).toContain("batch");
    expect(guard).toContain("modules/");
  });
});
