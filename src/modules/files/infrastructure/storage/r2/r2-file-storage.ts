import type { Env } from "../../../../../worker/env.js";
import type {
  FileStorageBody,
  FileStorageHead,
  FileStorageRange,
  IFileStoragePort,
} from "../../../application/ports/file-storage.js";

/** The only adapter allowed to access the private Cloudflare R2 bucket binding. */
export class R2FileStorage implements IFileStoragePort {
  constructor(private readonly bucket: Env["FILES_BUCKET"]) {}

  async put(
    key: string,
    body: ReadableStream<Uint8Array>,
    contentType: string,
  ): Promise<void> {
    await this.bucket.put(key, body, { httpMetadata: { contentType } });
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
}

export function createR2FileStorage(env: Env): IFileStoragePort | null {
  if (!env.FILES_BUCKET) return null;
  return new R2FileStorage(env.FILES_BUCKET);
}
