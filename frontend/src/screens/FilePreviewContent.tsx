import type { FilesFileView } from "../services/files-contract";
import type { PreviewKind } from "./preview-format";
import { MarkdownPreview } from "./MarkdownPreview";
import { Button } from "../ui/Button";

export function FilePreviewContent({
  file,
  kind,
  url,
  text,
  rows,
  loading,
  error,
  tooLarge,
  onRetry,
}: {
  file: FilesFileView;
  kind: PreviewKind;
  url: string;
  text: string;
  rows: string[][];
  loading: boolean;
  error: string;
  tooLarge: boolean;
  onRetry: () => void;
}) {
  const needsCors = kind === "text" || kind === "docx" || kind === "xlsx";

  return (
    <div className="vd-preview__body" aria-live="polite">
      {loading ? <p role="status">Preparando vista previa segura…</p> : null}
      {error ? (
        <div role="alert" className="vd-preview__error">
          <p>{error}</p>
          {needsCors ? (
            <p>
              Para texto y Office, comprueba la política CORS del bucket R2.
              También puedes abrir el original o descargar el archivo.
            </p>
          ) : (
            <p>
              Comprueba tu conexión o vuelve a generar el enlace privado del
              archivo.
            </p>
          )}
          <Button size="sm" variant="secondary" onClick={onRetry}>
            Reintentar vista previa
          </Button>
        </div>
      ) : null}
      {!loading && !error && tooLarge ? (
        <div className="vd-preview__notice" role="status">
          <p>
            La vista previa de texto y documentos está limitada a 25 MiB.
            Descarga el archivo para abrirlo completo.
          </p>
        </div>
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
        /\.(?:md|markdown)$/i.test(file.name) ? (
          <MarkdownPreview source={text} />
        ) : (
          <pre className="vd-preview__text">{text}</pre>
        )
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
            <p>Primera hoja, máximo 500 filas y 100 columnas.</p>
          </div>
        ) : (
          <p>La hoja está vacía.</p>
        )
      ) : null}
    </div>
  );
}
