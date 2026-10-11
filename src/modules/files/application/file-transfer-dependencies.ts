import type {
  FilesCatalogNameRepository,
  FilesFolderRepository,
  FilesItemRepository,
  FilesTransferEventRepository,
  FilesUploadRepository,
} from "./ports/files-repositories.js";
import type { IFileStoragePort } from "./ports/file-storage.js";

export interface FileTransferDependencies {
  folders: FilesFolderRepository;
  items: FilesItemRepository;
  names: FilesCatalogNameRepository;
  uploads: FilesUploadRepository;
  transferEvents: FilesTransferEventRepository;
  storage: IFileStoragePort;
  now?: () => Date;
  createId?: () => string;
}
