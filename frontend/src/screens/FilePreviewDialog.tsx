import { useEffect, useRef, useState } from "react";
import type { FilesFileView } from "../services/files-contract";
import {
  createFilePreviewUrl,
  downloadFileUrl,
  FilesApiError,
} from "../services/files-service";
import { fetchPreviewBytes } from "../services/preview-http-client";
import { Button } from "../ui/Button";
import { Icon } from "../ui/Icon";
import { fileTypeIcon, fileTypeLabel, fileVisualType } from "../lib/file-type-icon";
import { readDocx, readXlsx } from "./office-document-parser";
import { FilePreviewContent } from "./FilePreviewContent";
import { previewKind } from "./preview-format";

export function FilePreviewDialog({
  file,
  onClose,
}: {
  file: FilesFileView;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [rows, setRows] = useState<string[][]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retryKey, setRetryKey] = useState(0);
  const kind = previewKind(file.name);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();

    let cancelled = false;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setUrl("");
    setText("");
    setRows([]);

    void createFilePreviewUrl(file.id)
      .then(async (result) => {
        if (cancelled) return;
        setUrl(result.url);
        const needsLocalRead =
          kind === "text" || kind === "docx" || kind === "xlsx";
        if (needsLocalRead && file.sizeBytes <= 25 * 1024 * 1024) {
          const buffer = await fetchPreviewBytes(result.url, controller.signal);
          if (cancelled) return;
          if (kind === "text") {
            setText(
              new TextDecoder("utf-8").decode(buffer).replace(/^\uFEFF/, ""),
            );
          } else if (kind === "docx") {
            setText(await readDocx(buffer));
          } else if (kind === "xlsx") {
            setRows(await readXlsx(buffer));
          }
        }
      })
      .catch((cause: unknown) => {
        if (cancelled || controller.signal.aborted) return;
        setError(
          cause instanceof FilesApiError || cause instanceof Error
            ? cause.message
            : "No se pudo abrir la vista previa.",
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [file.id, file.sizeBytes, kind, retryKey]);

  function close() {
    dialogRef.current?.close();
    onClose();
  }

  const localRead = kind === "text" || kind === "docx" || kind === "xlsx";
  const tooLarge = localRead && file.sizeBytes > 25 * 1024 * 1024;

  return (
    <dialog
      ref={dialogRef}
      className="vd-preview"
      aria-label={"Vista previa: " + file.name}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <header className="vd-preview__header">
        <div className="vd-preview__title-wrap">
          <span
            className={
              "vd-catalog__node-icon vd-catalog__node-icon--" +
              fileVisualType(file.name)
            }
            title={fileTypeLabel(file.name)}
            aria-hidden="true"
          >
            <Icon name={fileTypeIcon(file.name)} size="md" />
          </span>
          <h2 className="vd-preview__title">{file.name}</h2>
        </div>
        <div className="vd-preview__actions">
          {url ? (
            <a
              className="vd-preview__open-link"
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              referrerPolicy="no-referrer"
            >
              Abrir original
            </a>
          ) : null}
          <Button
            size="sm"
            variant="secondary"
            onClick={() => window.location.assign(downloadFileUrl(file.id))}
          >
            Descargar
          </Button>
          <Button size="sm" variant="ghost" onClick={close}>
            Cerrar
          </Button>
        </div>
      </header>
      <FilePreviewContent
        file={file}
        kind={kind}
        url={url}
        text={text}
        rows={rows}
        loading={loading}
        error={error}
        tooLarge={tooLarge}
        onRetry={() => setRetryKey((value) => value + 1)}
      />
    </dialog>
  );
}
