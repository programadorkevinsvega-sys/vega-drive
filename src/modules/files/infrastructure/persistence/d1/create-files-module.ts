import type { Env } from "../../../../../worker/env.js";
import { createFilesModule } from "../../../module.public-api.js";
import { D1FilesCatalogNameRepository } from "./d1-files-catalog-name.repository.js";
import { D1FilesFolderRepository } from "./d1-files-folder.repository.js";
import { D1FilesItemRepository } from "./d1-files-item.repository.js";
import { D1FilesUploadRepository } from "./d1-files-upload.repository.js";
import { D1FilesMultipartUploadRepository } from "./d1-files-multipart-upload.repository.js";
import { D1FilesTransferEventRepository } from "./d1-files-transfer-event.repository.js";
import { createR2FileStorage } from "../../storage/r2/r2-file-storage.js";

export function createFilesModuleFromD1(env: Env) {
  const storage = createR2FileStorage(env);
  return createFilesModule({
    folders: new D1FilesFolderRepository(env.VEGA_DRIVE_DB),
    items: new D1FilesItemRepository(env.VEGA_DRIVE_DB),
    names: new D1FilesCatalogNameRepository(env.VEGA_DRIVE_DB),
    uploads: new D1FilesUploadRepository(env.VEGA_DRIVE_DB),
    multipartUploads: new D1FilesMultipartUploadRepository(env.VEGA_DRIVE_DB),
    transferEvents: new D1FilesTransferEventRepository(env.VEGA_DRIVE_DB),
    ...(storage ? { storage } : {}),
    ready: Boolean(env.VEGA_DRIVE_DB && storage),
  });
}
