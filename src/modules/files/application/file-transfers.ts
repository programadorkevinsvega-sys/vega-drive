import type { FileTransferDependencies } from "./file-transfer-dependencies.js";
import { createFileTransferCleanup } from "./file-transfer-cleanup.js";
import { createFileDownload } from "./file-download.js";
import { createFileUpload } from "./file-upload.js";

export function createFileTransfers(deps: FileTransferDependencies) {
  return {
    uploadFile: createFileUpload(deps),
    downloadFile: createFileDownload(deps),
    cleanupExpiredUploads: createFileTransferCleanup(deps),
  };
}
