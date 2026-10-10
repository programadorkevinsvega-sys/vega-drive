import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("Cloudflare deployment guard", () => {
  it("blocks deployment while the D1 ID is still a placeholder", () => {
    const result = spawnSync(
      process.execPath,
      ["scripts/check-cloudflare-config.mjs"],
      { encoding: "utf8" },
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("database_id marcador");
  });
});
