export interface FileStorageRange {
  offset: number;
  length: number;
}

export interface FileStorageHead {
  sizeBytes: number;
  contentType: string | null;
}

export interface FileStorageBody extends FileStorageHead {
  body: ReadableStream<Uint8Array>;
}

export interface FileStorageMultipartPart {
  partNumber: number;
  etag: string;
  sizeBytes: number;
}

/** Private storage port. Its implementation is owned by files infrastructure. */
export interface IFileStoragePort {
  put(
    key: string,
    body: ReadableStream<Uint8Array>,
    contentType: string,
    sizeBytes: number,
  ): Promise<void>;
  head(key: string): Promise<FileStorageHead | null>;
  get(key: string, range?: FileStorageRange): Promise<FileStorageBody | null>;
  delete(key: string): Promise<void>;
  /** Optional short-lived URL; callers must authorize the logical file first. */
  presignGetUrl?(
    key: string,
    expiresInSeconds: number,
    downloadName: string,
  ): Promise<string | null>;
  createMultipartUpload?(key: string, contentType: string): Promise<string>;
  uploadMultipartPart?(
    key: string,
    uploadId: string,
    partNumber: number,
    body: ReadableStream<Uint8Array>,
    expectedSizeBytes: number,
  ): Promise<FileStorageMultipartPart>;
  completeMultipartUpload?(
    key: string,
    uploadId: string,
    parts: FileStorageMultipartPart[],
  ): Promise<void>;
  abortMultipartUpload?(key: string, uploadId: string): Promise<void>;
}
