import { useRef, useState, type ChangeEvent } from "react";
import { FilesApiError } from "../services/files-service";
import { createFolderResolver } from "../services/files-folder-upload";
import { uploadFile } from "../services/files-transfer-service";
import { Button } from "../ui/Button";
import { UploadQueue, type UploadItem } from "./UploadQueue";

interface FileTransferControlsProps {
  folderId: string | null;
  onUploaded: () => void;
}

/** Controles de transferencia same-origin; los límites del servidor son autoritativos. */
export function FileTransferControls({
  folderId,
  onUploaded,
}: FileTransferControlsProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [items, setItems] = useState<UploadItem[]>([]);
  const [summary, setSummary] = useState("");

  function updateItem(id: string, changes: Partial<UploadItem>) {
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, ...changes } : item)),
    );
  }

  async function handleSelection(
    event: ChangeEvent<HTMLInputElement>,
    includeFolderStructure = false,
  ) {
    const files = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = "";
    if (files.length === 0) return;

    const uploads = files.map<UploadItem>((file, index) => ({
      id: String(index) + "-" + file.name + "-" + file.lastModified,
      file,
      state: "pending",
      progress: 0,
      error: "",
    }));
    setItems(uploads);
    setSummary("Preparando " + files.length + " archivo(s)…");
    setUploading(uploads.some((item) => item.state === "pending"));
    let completed = 0;
    let failed = 0;
    const resolveFolder = createFolderResolver(folderId);

    try {
      for (let index = 0; index < uploads.length; index += 1) {
        const item = uploads[index];
        if (!item) continue;
        updateItem(item.id, { state: "uploading", progress: 0 });
        const fileLabel = includeFolderStructure
          ? item.file.webkitRelativePath || item.file.name
          : item.file.name;
        setSummary(
          (includeFolderStructure ? "Organizando y subiendo " : "Subiendo ") +
            (index + 1) +
            " de " +
            files.length +
            ": " +
            fileLabel,
        );
        try {
          const targetFolder = await resolveFolder(
            item.file,
            includeFolderStructure,
          );
          await uploadFile(item.file, targetFolder, (progress) => {
            updateItem(item.id, { progress });
          });
          updateItem(item.id, {
            state: "completed",
            progress: 100,
            error: "",
          });
          completed += 1;
        } catch (cause) {
          const message =
            cause instanceof FilesApiError
              ? cause.message
              : "No se pudo completar la subida. Inténtalo de nuevo.";
          updateItem(item.id, { state: "error", error: message });
          failed += 1;
        }
      }
    } finally {
      setUploading(false);
    }

    if (completed > 0) onUploaded();
    if (failed > 0) {
      setSummary(
        completed > 0
          ? "Proceso terminado: " +
              completed +
              " completado(s), " +
              failed +
              " con error."
          : "No se pudo subir ningún archivo. Revisa los detalles e inténtalo de nuevo.",
      );
      return;
    }
    setSummary(
      completed === 1
        ? "Archivo subido correctamente."
        : "Se subieron " + completed + " archivos correctamente.",
    );
  }

  return (
    <div className="vd-transfer">
      <input
        ref={inputRef}
        className="vd-transfer__input"
        type="file"
        multiple
        disabled={uploading}
        onChange={(event) => void handleSelection(event)}
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
        onChange={(event) => void handleSelection(event, true)}
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
        onClear={() => {
          setItems([]);
          setSummary("");
        }}
      />
    </div>
  );
}
