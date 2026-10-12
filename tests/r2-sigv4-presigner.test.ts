import { describe, expect, it } from "vitest";
import { presignR2Object } from "../src/modules/files/infrastructure/storage/r2/r2-sigv4-presigner.js";

const config = {
  accountId: "0123456789abcdef0123456789abcdef",
  bucketName: "vega-drive-files",
  accessKeyId: "test-access-key",
  secretAccessKey: "test-secret-key",
};

describe("R2 SigV4 presigner", () => {
  it("signs short-lived GET URLs safely", async () => {
    const url = new URL(
      await presignR2Object(
        config,
        {
          method: "GET",
          key: "u/user-id/file-id",
          expiresInSeconds: 120,
          query: { "response-content-type": "application/octet-stream" },
        },
        new Date("2026-10-11T12:34:56.000Z"),
      ),
    );

    expect(url.hostname).toBe(config.accountId + ".r2.cloudflarestorage.com");
    expect(url.pathname).toBe("/vega-drive-files/u/user-id/file-id");
    expect(url.searchParams.get("X-Amz-Algorithm")).toBe("AWS4-HMAC-SHA256");
    expect(url.searchParams.get("X-Amz-Expires")).toBe("120");
    expect(url.searchParams.get("X-Amz-SignedHeaders")).toBe("host");
    expect(url.searchParams.get("response-content-type")).toBe(
      "application/octet-stream",
    );
    expect(url.searchParams.get("X-Amz-Signature")).toMatch(/^[a-f0-9]{64}$/);
  });

  it("binds PUT content type into the signature", async () => {
    const url = new URL(
      await presignR2Object(
        config,
        {
          method: "PUT",
          key: "u/user-id/file-id",
          contentType: "application/octet-stream",
          ifNoneMatch: "*",
          expiresInSeconds: 120,
        },
        new Date("2026-10-11T12:34:56.000Z"),
      ),
    );

    expect(url.searchParams.get("X-Amz-SignedHeaders")).toBe(
      "content-type;if-none-match;host",
    );
    expect(url.searchParams.get("X-Amz-Signature")).toMatch(/^[a-f0-9]{64}$/);
  });

  it("rejects long-lived signatures and unsafe object keys", async () => {
    await expect(
      presignR2Object(config, {
        method: "GET",
        key: "u/user-id/file-id",
        expiresInSeconds: 901,
      }),
    ).rejects.toThrow("Invalid R2 presign configuration");
    await expect(
      presignR2Object(config, {
        method: "GET",
        key: "../other-user/file",
        expiresInSeconds: 120,
      }),
    ).rejects.toThrow("Invalid R2 presign configuration");
  });
});
