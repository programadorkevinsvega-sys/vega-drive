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

export interface FilesRecentItem {
  file: FilesFileView;
  activityType: "open" | "download";
  lastActivityAt: string;
}

export interface FilesRecentListing {
  items: FilesRecentItem[];
  nextCursor: string | null;
}


export interface FilesFavoriteItem {
  file: FilesFileView;
  favoritedAt: string;
}
export interface FilesFavoritesListing {
  items: FilesFavoriteItem[];
  nextCursor: string | null;
}
