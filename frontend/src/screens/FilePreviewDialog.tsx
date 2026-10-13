import { useEffect, useRef, useState } from "react";
import type { FilesFileView } from "../services/files-contract";
import {
  createFilePreviewUrl,
  downloadFileUrl,
  FilesApiError,
} from "../services/files-service";
import { Button } from "../ui/Button";
import { Icon } from "../ui/Icon";
import {
  fetchPreviewBytes,
  previewKind,
  readDocx,
  readXlsx,
} from "./preview-format";

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
  const kind = previewKind(file.name);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();

    let cancelled = false;
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
          const buffer = await fetchPreviewBytes(result.url);
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
        if (!cancelled) {
          setError(
            cause instanceof FilesApiError || cause instanceof Error
              ? cause.message
              : "No se pudo abrir la vista previa.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [file.id, file.sizeBytes, kind]);

  function close() {
    dialogRef.current?.close();
    onClose();
  }

  const localRead =
    kind === "text" || kind === "docx" || kind === "xlsx";
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
          <Icon name="file" size="md" />
          <h2 className="vd-preview__title">{file.name}</h2>
        </div>
        <div className="vd-preview__actions">
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

      <div className="vd-preview__body" aria-live="polite">
        {loading ? (
          <p role="status">Preparando vista previa segura…</p>
        ) : null}
        {error ? (
          <div role="alert" className="vd-preview__error">
            <p>{error}</p>
            <p>
              Para texto y Office, verifica la política CORS del bucket R2.
              También puedes descargar el archivo.
            </p>
          </div>
        ) : null}
        {!loading && !error && tooLarge ? (
          <p>
            La vista previa de texto y documentos está limitada a 25 MB.
            Descarga el archivo para abrirlo completo.
          </p>
        ) : null}
        {!loading && !error && !tooLarge && url && kind === "image" ? (
          <img
            className="vd-preview__image"
            src={url}
            alt={file.name}
            referrerPolicy="no-referrer"
          />
        ) : null}
        {!loading && !error && !tooLarge && url && kind === "video" ? (
          <video
            className="vd-preview__media"
            src={url}
            controls
            preload="metadata"
            playsInline
          >
            Tu navegador no puede reproducir este vídeo.
          </video>
        ) : null}
        {!loading && !error && !tooLarge && url && kind === "audio" ? (
          <audio
            className="vd-preview__audio"
            src={url}
            controls
            preload="metadata"
          >
            Tu navegador no puede reproducir este audio.
          </audio>
        ) : null}
        {!loading && !error && !tooLarge && url && kind === "pdf" ? (
          <iframe
            className="vd-preview__pdf"
            src={url}
            title={"PDF: " + file.name}
            referrerPolicy="no-referrer"
          />
        ) : null}
        {!loading && !error && !tooLarge && kind === "text" ? (
          <pre className="vd-preview__text">{text}</pre>
        ) : null}
        {!loading && !error && !tooLarge && kind === "docx" ? (
          <article className="vd-preview__document">
            <pre>{text || "El documento no contiene texto extraíble."}</pre>
          </article>
        ) : null}
        {!loading && !error && !tooLarge && kind === "xlsx" ? (
          rows.length ? (
            <div className="vd-preview__sheet">
              <table>
                <tbody>
                  {rows.map((row, rowIndex) => (
                    <tr key={rowIndex}>
                      {row.map((cell, cellIndex) => (
                        <td key={cellIndex}>{cell ?? ""}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              <p>Primera hoja, máximo 500 filas.</p>
            </div>
          ) : (
            <p>La hoja está vacía.</p>
          )
        ) : null}
      </div>
    </dialog>
  );
}
