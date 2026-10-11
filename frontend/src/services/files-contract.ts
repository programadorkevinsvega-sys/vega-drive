export interface FilesFolderView {
  type: "folder";
  id: string;
  name: string;
  parentFolderId: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface FilesFileView {
  type: "file";
  id: string;
  name: string;
  folderId: string | null;
  sizeBytes: number;
  contentType: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export type FilesCatalogNode = FilesFolderView | FilesFileView;

export interface FilesFolderListing {
  folder: FilesFolderView | null;
  breadcrumbs: Array<{ id: string | null; name: string }>;
  folders: FilesFolderView[];
  files: FilesFileView[];
  nextCursor: string | null;
}

export interface FilesTrashListing {
  nodes: FilesCatalogNode[];
  nextCursor: string | null;
}
