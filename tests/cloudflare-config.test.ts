import { spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("Cloudflare deployment guard", () => {
  it("blocks deployment while the D1 ID is still a placeholder", async () => {
    const tempDirectory = await mkdtemp(join(tmpdir(), "vega-drive-config-"));
    const configPath = join(tempDirectory, "wrangler.toml");

    try {
      await writeFile(
        configPath,
        [
          "[[d1_databases]]",
          'binding = "VEGA_DRIVE_DB"',
          'database_name = "vega_drive_db"',
          'database_id = "00000000-0000-0000-0000-000000000000"',
          "",
          "[[r2_buckets]]",
          'binding = "VEGA_DRIVE_FILES"',
          'bucket_name = "vega-drive-files"',
          "",
        ].join("\n"),
      );

      const result = spawnSync(
        process.execPath,
        ["scripts/check-cloudflare-config.mjs"],
        {
          encoding: "utf8",
          env: {
            ...process.env,
            VEGA_DRIVE_WRANGLER_CONFIG: configPath,
          },
        },
      );

      expect(result.status).toBe(1);
      expect(result.stderr).toContain("database_id marcador");
    } finally {
      await rm(tempDirectory, { recursive: true, force: true });
    }
  });

  it("blocks deployment when the production Turnstile hostname allowlist is missing", async () => {
    const tempDirectory = await mkdtemp(join(tmpdir(), "vega-drive-config-"));
    const configPath = join(tempDirectory, "wrangler.toml");

    try {
      await writeFile(
        configPath,
        [
          "[[d1_databases]]",
          'binding = "VEGA_DRIVE_DB"',
          'database_name = "vega_drive_db"',
          'database_id = "822bf438-18c7-4492-9436-139988c1ec78"',
          "",
          "[[r2_buckets]]",
          'binding = "FILES_BUCKET"',
          'bucket_name = "vega-drive-files"',
          "",
          "[vars]",
          'TURNSTILE_SITE_KEY = "test-site-key"',
          "",
        ].join("\n"),
      );

      const result = spawnSync(
        process.execPath,
        ["scripts/check-cloudflare-config.mjs"],
        {
          encoding: "utf8",
          env: {
            ...process.env,
            VEGA_DRIVE_WRANGLER_CONFIG: configPath,
          },
        },
      );

      expect(result.status).toBe(1);
      expect(result.stderr).toContain("TURNSTILE_HOSTNAMES");
    } finally {
      await rm(tempDirectory, { recursive: true, force: true });
    }
  });
});
