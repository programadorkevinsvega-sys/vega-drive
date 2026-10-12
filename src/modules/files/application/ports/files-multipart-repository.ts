export interface FilesMultipartSession {
  id: string;
  ownerId: string;
  reservationId: string;
  itemId: string;
  folderId: string | null;
  name: string;
  storageKey: string;
  r2UploadId: string;
  expectedSizeBytes: number;
  contentType: string;
  createdAt: string;
  expiresAt: string;
}

export interface FilesMultipartPart {
  sessionId: string;
  partNumber: number;
  etag: string;
  sizeBytes: number;
}

export interface FilesMultipartUploadRepository {
  insert(session: FilesMultipartSession): Promise<void>;
  findByIdForOwner(
    id: string,
    ownerId: string,
  ): Promise<FilesMultipartSession | null>;
  /** Finds same-name multipart sessions left before the first part was stored. */
  findAbandonedUnstartedForOwnerAndName?(
    ownerId: string,
    folderId: string | null,
    name: string,
    createdBefore: string,
  ): Promise<FilesMultipartSession | null>;
  savePart(part: FilesMultipartPart): Promise<void>;
  listParts(sessionId: string): Promise<FilesMultipartPart[]>;
  delete(id: string, ownerId: string): Promise<boolean>;
  listExpired(now: string, limit: number): Promise<FilesMultipartSession[]>;
}
