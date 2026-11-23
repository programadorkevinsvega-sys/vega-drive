export type FilesSearchNodeType = "folder" | "file";

export interface FilesSearchCursor {
  name: string;
  type: FilesSearchNodeType;
  id: string;
}

export interface FilesSearchRecord {
  type: FilesSearchNodeType;
  id: string;
  ownerId: string;
  folderId: string | null;
  name: string;
  sizeBytes: number | null;
  contentType: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export type FilesSearchType = "all" | "files" | "folders";

export interface FilesSearchRepository {
  searchByOwner(
    ownerId: string,
    query: string,
    type: FilesSearchType,
    limit: number,
    cursor?: FilesSearchCursor | null,
  ): Promise<FilesSearchRecord[]>;
}
