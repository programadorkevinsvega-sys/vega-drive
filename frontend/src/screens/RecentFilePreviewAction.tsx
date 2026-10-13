import { useState } from "react";
import type { FilesFileView } from "../services/files-contract";
import { Button } from "../ui/Button";
import { FilePreviewDialog } from "./FilePreviewDialog";
import { canPreviewFile } from "./preview-format";

export function RecentFilePreviewAction({ file }: { file: FilesFileView }) {
  const [open, setOpen] = useState(false);
  if (!canPreviewFile(file.name)) return null;
  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
        Vista previa
      </Button>
      {open ? (
        <FilePreviewDialog file={file} onClose={() => setOpen(false)} />
      ) : null}
    </>
  );
}
