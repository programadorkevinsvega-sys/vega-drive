import { describe, expect, it } from "vitest";
import { presignR2Object } from "../../../../src/modules/files/infrastructure/storage/r2/r2-sigv4-presigner.js";

const config = {
  accountId: "0123456789abcdef0123456789abcdef",
  bucketName: "vega-drive-files",
  accessKeyId: "TESTACCESSKEY",
  secretAccessKey: "wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY",
};

const fixedDate = new Date("2026-11-22T22:00:00.000Z");

describe("R2 SigV4 presigner", () => {
  it("creates a valid deterministic signature for a normal GET URL", async () => {
    const url = await presignR2Object(
      config,
      {
        method: "GET",
        key: "u/user/file.txt",
        expiresInSeconds: 900,
      },
      fixedDate,
    );

    const parsed = new URL(url);
    expect(parsed.origin).toBe(
      "https://0123456789abcdef0123456789abcdef.r2.cloudflarestorage.com",
    );
    expect(parsed.pathname).toBe("/vega-drive-files/u/user/file.txt");
    expect(parsed.searchParams.get("X-Amz-Signature")).toBe(
      "bc7fb63768f7c3d133e2a3c082205c21227c966168404bf1b3fffe4de17f274a",
    );
    expect(parsed.searchParams.get("X-Amz-SignedHeaders")).toBe("host");
  });

  it("signs both response overrides used by inline document previews", async () => {
    const url = await presignR2Object(
      config,
      {
        method: "GET",
        key: "u/user/file.txt",
        expiresInSeconds: 900,
        query: {
          "response-content-disposition":
            'inline; filename="Acuerdo_de_confidencialidad-Factus-2026_.docx"',
          "response-content-type":
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        },
      },
      fixedDate,
    );

    const parsed = new URL(url);
    expect(parsed.searchParams.get("response-content-disposition")).toBe(
      'inline; filename="Acuerdo_de_confidencialidad-Factus-2026_.docx"',
    );
    expect(parsed.searchParams.get("response-content-type")).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    expect(parsed.searchParams.get("X-Amz-Signature")).toBe(
      "a14430df894964674e545de113198a80667b4bb1c30703a92382e4f87e84b77e",
    );
  });

  it("sorts query parameter names after URI encoding", async () => {
    const url = await presignR2Object(
      config,
      {
        method: "GET",
        key: "u/user/file.txt",
        expiresInSeconds: 900,
        query: {
          "a/b": "value/with space",
          "a-b": "other",
        },
      },
      fixedDate,
    );

    const parsed = new URL(url);
    expect(parsed.search).toContain("&a%2Fb=value%2Fwith%20space&a-b=other&");
    expect(parsed.searchParams.get("X-Amz-Signature")).toBe(
      "3f7badd75d4944168b1cc4404b9ca166aed2f011a97e62cc1edb96c42fdb1140",
    );
  });
});
