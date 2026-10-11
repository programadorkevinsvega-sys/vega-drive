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

/** Private storage port. Its implementation is owned by files infrastructure. */
export interface IFileStoragePort {
  put(
    key: string,
    body: ReadableStream<Uint8Array>,
    contentType: string,
  ): Promise<void>;
  head(key: string): Promise<FileStorageHead | null>;
  get(key: string, range?: FileStorageRange): Promise<FileStorageBody | null>;
  delete(key: string): Promise<void>;
}
