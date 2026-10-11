import { useRef, useState, type ChangeEvent } from "react";
import { uploadFile, FilesApiError } from "../services/files-service";
import { Button } from "../ui/Button";

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
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  async function handleSelection(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = "";
    if (files.length === 0) return;

    const oversized = files.find((file) => file.size > MAX_FILE_SIZE_BYTES);
    if (oversized) {
      setError(oversized.name + " supera el límite de 95 MiB.");
      setStatus("");
      return;
    }

    setUploading(true);
    setError("");
    setStatus("");
    let uploaded = 0;
    const failed: string[] = [];
    let lastError = "";

    try {
      for (let index = 0; index < files.length; index += 1) {
        const file = files[index];
        if (!file) continue;
        setStatus(
          "Subiendo " + (index + 1) + " de " + files.length + ": " + file.name,
        );
        try {
          await uploadFile(file, folderId);
          uploaded += 1;
        } catch (cause) {
          failed.push(file.name);
          lastError =
            cause instanceof FilesApiError
              ? cause.message
              : "No se pudo completar la subida. Inténtalo de nuevo.";
        }
      }
    } finally {
      setUploading(false);
    }

    if (uploaded > 0) onUploaded();
    if (failed.length > 0) {
      setError("No se pudieron subir " + failed.join(", ") + ". " + lastError);
      setStatus(
        uploaded > 0
          ? "Se subieron " + uploaded + " de " + files.length + " archivos."
          : "",
      );
      return;
    }
    setStatus(
      uploaded === 1
        ? "Archivo subido correctamente."
        : "Se subieron " + uploaded + " archivos correctamente.",
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
      {status ? (
        <span className="vd-transfer__status" role="status">
          {status}
        </span>
      ) : null}
      {error ? (
        <span className="vd-transfer__error" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}
