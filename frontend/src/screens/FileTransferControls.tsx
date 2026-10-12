import { useRef, useState, type ChangeEvent } from "react";
import { FilesApiError } from "../services/files-service";
import { uploadFile } from "../services/files-transfer-service";
import { Button } from "../ui/Button";
import { UploadQueue, type UploadItem } from "./UploadQueue";

const MAX_FILE_SIZE_BYTES = 95 * 1024 * 1024;

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
  const [uploading, setUploading] = useState(false);
  const [items, setItems] = useState<UploadItem[]>([]);
  const [summary, setSummary] = useState("");

  function updateItem(id: string, changes: Partial<UploadItem>) {
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, ...changes } : item)),
    );
  }

  async function handleSelection(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = "";
    if (files.length === 0) return;

    const uploads = files.map<UploadItem>((file, index) => ({
      id: String(index) + "-" + file.name + "-" + file.lastModified,
      file,
      state: file.size > MAX_FILE_SIZE_BYTES ? "error" : "pending",
      progress: 0,
      error:
        file.size > MAX_FILE_SIZE_BYTES ? "Supera el límite de 95 MiB." : "",
    }));
    setItems(uploads);
    setSummary("Preparando " + files.length + " archivo(s)…");
    setUploading(uploads.some((item) => item.state === "pending"));
    let completed = 0;
    let failed = uploads.filter((item) => item.state === "error").length;

    try {
      for (let index = 0; index < uploads.length; index += 1) {
        const item = uploads[index];
        if (!item || item.state === "error") continue;
        updateItem(item.id, { state: "uploading", progress: 0 });
        setSummary(
          "Subiendo archivo " +
            (index + 1) +
            " de " +
            files.length +
            ": " +
            item.file.name,
        );
        try {
          await uploadFile(item.file, folderId, (progress) => {
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
        aria-label="Seleccionar archivos para subir"
      />
      <Button
        icon="upload"
        variant="secondary"
        disabled={uploading}
        loading={uploading}
        onClick={() => inputRef.current?.click()}
      >
        {uploading ? "Subiendo…" : "Subir archivos"}
      </Button>

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
