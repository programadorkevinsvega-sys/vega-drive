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

  it("binds PUT size and headers into the signature", async () => {
    const url = new URL(
      await presignR2Object(
        config,
        {
          method: "PUT",
          key: "u/user-id/file-id",
          contentType: "application/octet-stream",
          contentLength: 1024,
          ifNoneMatch: "*",
          expiresInSeconds: 120,
        },
        new Date("2026-10-11T12:34:56.000Z"),
      ),
    );

    expect(url.searchParams.get("X-Amz-SignedHeaders")).toBe(
      "content-length;content-type;if-none-match;host",
    );
    expect(url.searchParams.get("X-Amz-Signature")).toMatch(/^[a-f0-9]{64}$/);
  });

  it("binds method and exact object key into distinct signatures", async () => {
    const input = {
      key: "u/user-id/file-id",
      expiresInSeconds: 120,
    };
    const now = new Date("2026-10-11T12:34:56.000Z");
    const getUrl = new URL(
      await presignR2Object(config, { ...input, method: "GET" }, now),
    );
    const putUrl = new URL(
      await presignR2Object(config, { ...input, method: "PUT" }, now),
    );
    const otherKeyUrl = new URL(
      await presignR2Object(
        config,
        { ...input, method: "GET", key: "u/other-user/file-id" },
        now,
      ),
    );

    expect(getUrl.searchParams.get("X-Amz-Signature")).not.toBe(
      putUrl.searchParams.get("X-Amz-Signature"),
    );
    expect(getUrl.searchParams.get("X-Amz-Signature")).not.toBe(
      otherKeyUrl.searchParams.get("X-Amz-Signature"),
    );
  });

  it(
    "rejects reserved signing parameters, header injection and malformed keys",
    async () => {
      await expect(
        presignR2Object(config, {
          method: "GET",
          key: "u/user/file",
          expiresInSeconds: 120,
          query: { "X-Amz-Signature": "attacker-value" },
        }),
      ).rejects.toThrow("Invalid R2 presign configuration");
      await expect(
        presignR2Object(config, {
          method: "PUT",
          key: "u/user/file",
          contentType: "text/plain\r\nX-Injected: yes",
          expiresInSeconds: 120,
        }),
      ).rejects.toThrow("Invalid R2 presign configuration");
      await expect(
        presignR2Object(config, {
          method: "GET",
          key: "u//file",
          expiresInSeconds: 120,
        }),
      ).rejects.toThrow("Invalid R2 presign configuration");
      await expect(
        presignR2Object(config, {
          method: "GET",
          key: "u/user/file",
          expiresInSeconds: 120,
          query: { "response-content-type": "text/plain\nX-Injected: yes" },
        }),
      ).rejects.toThrow("Invalid R2 presign configuration");
    },
  );

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
