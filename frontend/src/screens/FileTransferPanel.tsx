import { useRef, type ChangeEvent } from "react";
import { Button } from "../ui/Button";
import { UploadQueue, type UploadItem } from "./UploadQueue";

interface FileTransferPanelProps {
  uploading: boolean;
  summary: string;
  items: UploadItem[];
  onSelection: (
    event: ChangeEvent<HTMLInputElement>,
    includeFolderStructure?: boolean,
  ) => void;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onCancel: (id: string) => void;
  onRemove: (id: string) => void;
  onCancelGroup: (groupId: string) => void;
  onClear: () => void;
}

export function FileTransferPanel({
  uploading,
  summary,
  items,
  onSelection,
  onPause,
  onResume,
  onCancel,
  onRemove,
  onCancelGroup,
  onClear,
}: FileTransferPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="vd-transfer">
      <input
        ref={inputRef}
        className="vd-transfer__input"
        type="file"
        multiple
        disabled={uploading}
        onChange={(event) => void onSelection(event)}
        aria-label="Seleccionar uno o varios archivos para subir"
      />
      <input
        ref={(element) => {
          folderInputRef.current = element;
          element?.setAttribute("webkitdirectory", "");
          element?.setAttribute("directory", "");
        }}
        className="vd-transfer__input"
        type="file"
        multiple
        disabled={uploading}
        onChange={(event) => void onSelection(event, true)}
        aria-label="Seleccionar una carpeta completa para subir"
      />
      <div className="vd-transfer__actions">
        <Button
          icon="upload"
          variant="secondary"
          disabled={uploading}
          loading={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? "Subiendo…" : "Subir archivos"}
        </Button>
        <Button
          icon="folder"
          variant="secondary"
          disabled={uploading}
          onClick={() => folderInputRef.current?.click()}
        >
          Subir carpeta
        </Button>
      </div>
      {summary ? (
        <span className="vd-transfer__status" role="status" aria-live="polite">
          {summary}
        </span>
      ) : null}
      <UploadQueue
        items={items}
        uploading={uploading}
        onPause={onPause}
        onResume={onResume}
        onCancel={onCancel}
        onRemove={onRemove}
        onCancelGroup={onCancelGroup}
        onClear={onClear}
      />
    </div>
  );
}
