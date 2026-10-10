import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { delimiter, join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const verifierPath = fileURLToPath(
  new URL("../scripts/verify-d1-schema.mjs", import.meta.url),
);

async function runVerifier(target?: "--local" | "--remote") {
  const root = await mkdtemp(join(tmpdir(), "vega-drive-d1-verifier-"));
  const migrations = join(root, "migrations");
  const bin = join(root, "bin");
  const argsPath = join(root, "wrangler-args.txt");

  try {
    await mkdir(migrations, { recursive: true });
    await mkdir(bin, { recursive: true });
    await writeFile(
      join(migrations, "0001_identity_initial.sql"),
      "CREATE TABLE identity_users (id TEXT PRIMARY KEY NOT NULL);",
    );

    const mockPnpm = join(bin, "pnpm");
    const mockScript = `#!/bin/sh
printf '%s\\n' "$@" > "$D1_ARGS_OUTPUT"
printf '%s\\n' '[{"success":true,"results":[{"type":"table","name":"identity_users","sql":"CREATE TABLE identity_users (id TEXT PRIMARY KEY NOT NULL)"},{"type":"table","name":"_cf_METADATA","sql":"CREATE TABLE _cf_METADATA (key TEXT PRIMARY KEY)"}]}]'
`;
    await writeFile(mockPnpm, mockScript);
    await chmod(mockPnpm, 0o755);

    const result = spawnSync(
      process.execPath,
      [verifierPath, ...(target ? [target] : [])],
      {
        cwd: root,
        encoding: "utf8",
        env: {
          ...process.env,
          D1_DATABASE_NAME: "test_db",
          D1_MIGRATIONS_DIR: migrations,
          D1_ARGS_OUTPUT: argsPath,
          PATH: bin + delimiter + (process.env.PATH ?? ""),
          WRANGLER_COMMAND: "pnpm",
        },
      },
    );
    const args = await readFile(argsPath, "utf8");
    return { result, args };
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

describe("D1 schema verifier target", () => {
  it("uses local D1 when --local is provided", async () => {
    const { result, args } = await runVerifier("--local");

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("D1 structural verification passed");
    expect(result.stdout).toContain("(local)");
    expect(args).toContain("--local");
    expect(args).not.toContain("--remote");
  });

  it("uses remote D1 by default and accepts an explicit --remote flag", async () => {
    const implicit = await runVerifier();
    const explicit = await runVerifier("--remote");

    expect(implicit.result.status).toBe(0);
    expect(implicit.args).toContain("--remote");
    expect(explicit.result.status).toBe(0);
    expect(explicit.args).toContain("--remote");
    expect(explicit.args).not.toContain("--local");
  });
});
