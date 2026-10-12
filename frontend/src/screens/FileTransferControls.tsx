import { useRef, useState, type ChangeEvent } from "react";
import { FilesApiError } from "../services/files-service";
import { createFolderResolver } from "../services/files-folder-upload";
import {
  uploadFile,
  UploadCancelledError,
  UploadController,
} from "../services/files-transfer-service";
import { type UploadItem } from "./UploadQueue";
import { FileTransferPanel } from "./FileTransferPanel";
import {
  cancelUpload,
  cancelUploadGroup,
  pauseUpload,
  removePendingUpload,
  resumeUpload,
} from "./upload-queue-actions";

interface FileTransferControlsProps {
  folderId: string | null;
  onUploaded: () => void;
}

/** Controles de transferencia same-origin; los límites del servidor son autoritativos. */
export function FileTransferControls({
  folderId,
  onUploaded,
}: FileTransferControlsProps) {
  const controlsRef = useRef(new Map<string, UploadController>());
  const [uploading, setUploading] = useState(false);
  const [items, setItems] = useState<UploadItem[]>([]);
  const [summary, setSummary] = useState("");

  function updateItem(id: string, changes: Partial<UploadItem>) {
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, ...changes } : item)),
    );
  }

  const pauseItem = (id: string) =>
    pauseUpload(controlsRef.current, updateItem, id);
  const resumeItem = (id: string) =>
    resumeUpload(controlsRef.current, updateItem, id);
  const cancelItem = (id: string) =>
    cancelUpload(controlsRef.current, updateItem, id);
  const removePendingItem = (id: string) =>
    removePendingUpload(controlsRef.current, setItems, id);
  const cancelGroup = (groupId: string) =>
    cancelUploadGroup(controlsRef.current, items, updateItem, groupId);

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
          controlsRef.current.delete(item.id);
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
    <FileTransferPanel
      uploading={uploading}
      summary={summary}
      items={items}
      onSelection={(event, includeFolderStructure) => {
        void handleSelection(event, includeFolderStructure);
      }}
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
  );
}
