import type { Env } from "../../../../../worker/env.js";
import { presignR2Object } from "./r2-sigv4-presigner.js";
import type {
  FileStorageBody,
  FileStorageHead,
  FileStorageMultipartPart,
  FileStorageRange,
  IFileStoragePort,
} from "../../../application/ports/file-storage.js";

function isMissingMultipartUpload(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const value = error as {
    status?: unknown;
    statusCode?: unknown;
    code?: unknown;
    name?: unknown;
    message?: unknown;
  };
  if (
    value.status === 404 ||
    value.statusCode === 404 ||
    value.code === "NoSuchUpload" ||
    value.name === "NoSuchUpload"
  ) {
    return true;
  }
  return (
    typeof value.message === "string" &&
    /NoSuchUpload|no such upload|upload(?: id)? .*?(?:not found|does not exist)/i.test(
      value.message,
    )
  );
}

/** The only adapter allowed to access the private Cloudflare R2 bucket binding. */
export class R2FileStorage implements IFileStoragePort {
  constructor(
    private readonly bucket: Env["FILES_BUCKET"],
    private readonly env: Env,
  ) {}

  async put(
    key: string,
    body: ReadableStream<Uint8Array>,
    contentType: string,
    sizeBytes: number,
  ): Promise<void> {
    const fixedLength = new FixedLengthStream(sizeBytes);
    await Promise.all([
      body.pipeTo(fixedLength.writable),
      this.bucket.put(key, fixedLength.readable, {
        httpMetadata: { contentType },
      }),
    ]);
  }

  async head(key: string): Promise<FileStorageHead | null> {
    const object = await this.bucket.head(key);
    if (!object) return null;
    return {
      sizeBytes: object.size,
      contentType: object.httpMetadata?.contentType ?? null,
    };
  }

  async get(
    key: string,
    range?: FileStorageRange,
  ): Promise<FileStorageBody | null> {
    const object = await this.bucket.get(
      key,
      range ? { range: { offset: range.offset, length: range.length } } : {},
    );
    if (!object || !("body" in object) || !object.body) return null;
    return {
      body: object.body,
      sizeBytes: object.size,
      contentType: object.httpMetadata?.contentType ?? null,
    };
  }

  async delete(key: string): Promise<void> {
    await this.bucket.delete(key);
  }

  async presignPutUrl(
    key: string,
    contentType: string,
    expectedSizeBytes: number,
    expiresInSeconds: number,
  ): Promise<string | null> {
    const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = this.env;
    if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
      return null;
    }
    return presignR2Object(
      {
        accountId: R2_ACCOUNT_ID,
        bucketName: "vega-drive-files",
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
      },
      {
        method: "PUT",
        key,
        contentType,
        contentLength: expectedSizeBytes,
        ifNoneMatch: "*",
        expiresInSeconds,
      },
    );
  }

  async presignMultipartPartUrl(
    key: string,
    uploadId: string,
    partNumber: number,
    expectedSizeBytes: number,
    expiresInSeconds: number,
  ): Promise<string | null> {
    const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = this.env;
    if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
      return null;
    }
    if (
      !uploadId ||
      !Number.isSafeInteger(partNumber) ||
      partNumber < 1 ||
      partNumber > 10_000
    ) {
      throw new Error("Invalid multipart part authorization");
    }
    return presignR2Object(
      {
        accountId: R2_ACCOUNT_ID,
        bucketName: "vega-drive-files",
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
      },
      {
        method: "PUT",
        key,
        contentLength: expectedSizeBytes,
        expiresInSeconds,
        query: { partNumber: String(partNumber), uploadId },
      },
    );
  }

  async presignGetUrl(
    key: string,
    expiresInSeconds: number,
    downloadName: string,
  ): Promise<string | null> {
    const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = this.env;
    if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
      return null;
    }
    const safeName =
      downloadName.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 120) || "download";
    return presignR2Object(
      {
        accountId: R2_ACCOUNT_ID,
        bucketName: "vega-drive-files",
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
      },
      {
        method: "GET",
        key,
        expiresInSeconds,
        query: {
          "response-content-disposition":
            'attachment; filename="' + safeName + '"',
          "response-content-type": "application/octet-stream",
        },
      },
    );
  }

  async createMultipartUpload(
    key: string,
    contentType: string,
  ): Promise<string> {
    const upload = await this.bucket.createMultipartUpload(key, {
      httpMetadata: { contentType },
    });
    return upload.uploadId;
  }

  async uploadMultipartPart(
    key: string,
    uploadId: string,
    partNumber: number,
    body: ReadableStream<Uint8Array>,
    expectedSizeBytes: number,
  ): Promise<FileStorageMultipartPart> {
    const fixedLength = new FixedLengthStream(expectedSizeBytes);
    const upload = this.bucket.resumeMultipartUpload(key, uploadId);
    const [part] = await Promise.all([
      upload.uploadPart(partNumber, fixedLength.readable),
      body.pipeTo(fixedLength.writable),
    ]);
    return {
      partNumber: part.partNumber,
      etag: part.etag,
      sizeBytes: expectedSizeBytes,
    };
  }

  async completeMultipartUpload(
    key: string,
    uploadId: string,
    parts: FileStorageMultipartPart[],
  ): Promise<void> {
    const upload = this.bucket.resumeMultipartUpload(key, uploadId);
    await upload.complete(
      parts.map(({ partNumber, etag }) => ({ partNumber, etag })),
    );
  }

  async abortMultipartUpload(key: string, uploadId: string): Promise<void> {
    try {
      await this.bucket.resumeMultipartUpload(key, uploadId).abort();
    } catch (error) {
      // Cleanup can be retried after R2 already aborted the upload but a later
      // D1/object cleanup step failed. Treat that missing upload as success.
      if (isMissingMultipartUpload(error)) return;
      throw error;
    }
  }
}

export function createR2FileStorage(env: Env): IFileStoragePort | null {
  if (!env.FILES_BUCKET) return null;
  return new R2FileStorage(env.FILES_BUCKET, env);
}
