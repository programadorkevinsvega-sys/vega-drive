import { useRef, useState, type ChangeEvent } from "react";
import { FilesApiError } from "../services/files-service";
import { uploadFile } from "../services/files-transfer-service";
import { Button } from "../ui/Button";

const MAX_FILE_SIZE_BYTES = 95 * 1024 * 1024;

type UploadState = "pending" | "uploading" | "completed" | "error";

interface UploadItem {
  id: string;
  file: File;
  state: UploadState;
  progress: number;
  error: string;
}

interface FileTransferControlsProps {
  folderId: string | null;
  onUploaded: () => void;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function stateLabel(item: UploadItem): string {
  if (item.state === "pending") return "En espera";
  if (item.state === "uploading") {
    return item.progress > 0
      ? "Subiendo · " + item.progress + "%"
      : "Preparando subida…";
  }
  return item.state === "completed" ? "Completado" : "No se pudo subir";
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
        file.size > MAX_FILE_SIZE_BYTES
          ? "Supera el límite de 95 MiB."
          : "",
    }));
    setItems(uploads);
    setSummary("Preparando " + files.length + " archivo(s)…");
    setUploading(uploads.some((item) => item.state === "pending"));
    let completed = 0;
    let failed = uploads.filter((item) => item.state === "error").length;

    try {
      for (const item of uploads) {
        if (item.state === "error") continue;
        updateItem(item.id, { state: "uploading", progress: 0 });
        setSummary("Subiendo archivos · " + (completed + failed + 1) + " de " + files.length);
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
          ? "Proceso terminado: " + completed + " completado(s), " + failed + " con error."
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

      {items.length > 0 ? (
        <section className="vd-transfer__queue" aria-label="Progreso de las subidas">
          <h2 className="vd-transfer__title">Subidas</h2>
          <ul className="vd-transfer__list">
            {items.map((item) => (
              <li
                className={"vd-transfer__item vd-transfer__item--" + item.state}
                key={item.id}
              >
                <div className="vd-transfer__item-heading">
                  <span className="vd-transfer__file-name" title={item.file.name}>
                    {item.file.name}
                  </span>
                  <span className="vd-transfer__file-size">
                    {formatFileSize(item.file.size)}
                  </span>
                </div>
                <div className="vd-transfer__item-meta">
                  <span>{stateLabel(item)}</span>
                  {item.state === "uploading" ? (
                    <span>{item.progress}%</span>
                  ) : null}
                </div>
                <progress
                  className="vd-transfer__progress"
                  max={100}
                  value={item.state === "pending" ? 0 : item.progress}
                  aria-label={"Progreso de " + item.file.name}
                  aria-valuetext={stateLabel(item)}
                />
                {item.error ? (
                  <p className="vd-transfer__item-error">{item.error}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
