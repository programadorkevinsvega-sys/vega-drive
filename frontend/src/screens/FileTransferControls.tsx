import { useRef, useState, type ChangeEvent } from "react";
import { FilesApiError } from "../services/files-service";
import { createFolderResolver } from "../services/files-folder-upload";
import {
  uploadFile,
  UploadCancelledError,
  UploadController,
} from "../services/files-transfer-service";
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
  const controlsRef = useRef(new Map<string, UploadController>());
  const [uploading, setUploading] = useState(false);
  const [items, setItems] = useState<UploadItem[]>([]);
  const [summary, setSummary] = useState("");

  function updateItem(id: string, changes: Partial<UploadItem>) {
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, ...changes } : item)),
    );
  }

  function pauseItem(id: string) {
    controlsRef.current.get(id)?.pause();
    updateItem(id, { state: "paused" });
  }

  function resumeItem(id: string) {
    controlsRef.current.get(id)?.resume();
    updateItem(id, { state: "uploading" });
  }

  function cancelItem(id: string) {
    controlsRef.current.get(id)?.cancel();
    updateItem(id, { state: "cancelled", error: "" });
  }

  function removePendingItem(id: string) {
    controlsRef.current.get(id)?.cancel();
    controlsRef.current.delete(id);
    setItems((current) => current.filter((item) => item.id !== id));
  }

  function cancelGroup(groupId: string) {
    for (const item of items) {
      if (
        item.groupId === groupId &&
        ["pending", "uploading", "paused"].includes(item.state)
      ) {
        controlsRef.current.get(item.id)?.cancel();
        updateItem(item.id, { state: "cancelled", error: "" });
      }
    }
  }

  async function handleSelection(
    event: ChangeEvent<HTMLInputElement>,
    includeFolderStructure = false,
  ) {
    const files = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = "";
    if (files.length === 0) return;

    const groupId = "batch-" + crypto.randomUUID();
    const uploads = files.map<UploadItem>((file, index) => {
      const id =
        String(index) +
        "-" +
        file.name +
        "-" +
        file.lastModified +
        "-" +
        groupId;
      controlsRef.current.set(id, new UploadController());
      return {
        id,
        file,
        state: "pending",
        progress: 0,
        error: "",
        groupId,
        folderBatch: includeFolderStructure,
      };
    });
    setItems(uploads);
    setSummary("Preparando " + files.length + " archivo(s)…");
    setUploading(true);
    let completed = 0;
    let failed = 0;
    let cancelled = 0;
    const resolveFolder = createFolderResolver(folderId);

    try {
      for (let index = 0; index < uploads.length; index += 1) {
        const item = uploads[index];
        if (!item) continue;
        const control = controlsRef.current.get(item.id);
        if (!control || control.cancelled) {
          cancelled += 1;
          continue;
        }

        updateItem(item.id, { state: "uploading", progress: 0, error: "" });
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
          await control.waitUntilReady();
          await uploadFile(
            item.file,
            targetFolder,
            (progress) => updateItem(item.id, { progress }),
            control,
          );
          updateItem(item.id, {
            state: "completed",
            progress: 100,
            error: "",
          });
          completed += 1;
        } catch (cause) {
          if (cause instanceof UploadCancelledError || control.cancelled) {
            updateItem(item.id, { state: "cancelled", error: "" });
            cancelled += 1;
            continue;
          }
          const message =
            cause instanceof FilesApiError
              ? cause.message
              : "No se pudo completar la subida. Inténtalo de nuevo.";
          updateItem(item.id, { state: "error", error: message });
          failed += 1;
        } finally {
          controlsRef.current.delete(item.id);
        }
      }
    } finally {
      setUploading(false);
    }

    if (completed > 0) onUploaded();
    if (failed > 0 || cancelled > 0) {
      setSummary(
        "Proceso terminado: " +
          completed +
          " completado(s), " +
          failed +
          " con error, " +
          cancelled +
          " cancelado(s).",
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
        onPause={pauseItem}
        onResume={resumeItem}
        onCancel={cancelItem}
        onRemove={removePendingItem}
        onCancelGroup={cancelGroup}
        onClear={() => {
          setItems((current) =>
            current.filter(
              (item) =>
                item.state !== "completed" &&
                item.state !== "error" &&
                item.state !== "cancelled",
            ),
          );
          setSummary("");
        }}
      />
    </div>
  );
}
