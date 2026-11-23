import type { Dispatch, SetStateAction } from "react";
import type { FilesFileView } from "../services/files-contract";
import { FilePreviewDialog } from "./FilePreviewDialog";
import { ShareDialog } from "./ShareDialog";

interface CatalogFileOverlaysProps {
  shareFile: FilesFileView | null;
  setShareFile: Dispatch<SetStateAction<FilesFileView | null>>;
  previewFile: FilesFileView | null;
  setPreviewFile: Dispatch<SetStateAction<FilesFileView | null>>;
}

export function CatalogFileOverlays({
  shareFile,
  setShareFile,
  previewFile,
  setPreviewFile,
}: CatalogFileOverlaysProps) {
  return (
    <>
      {shareFile ? (
        <ShareDialog file={shareFile} onClose={() => setShareFile(null)} />
      ) : null}
      {previewFile ? (
        <FilePreviewDialog
          file={previewFile}
          onClose={() => setPreviewFile(null)}
        />
      ) : null}
    </>
  );
}
