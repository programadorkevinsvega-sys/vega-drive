import type { ReactNode } from "react";
import { Button } from "../ui/Button";

export type UploadState = "pending" | "uploading" | "completed" | "error";

export interface UploadItem {
  id: string;
  file: File;
  state: UploadState;
  progress: number;
  error: string;
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

interface UploadQueueProps {
  items: UploadItem[];
  uploading: boolean;
  onClear: () => void;
}

export function UploadQueue({
  items,
  uploading,
  onClear,
}: UploadQueueProps): ReactNode {
  if (items.length === 0) return null;

  return (
    <section
      className="vd-transfer__queue"
      aria-label="Progreso de las subidas"
    >
      <div className="vd-transfer__queue-heading">
        <h2 className="vd-transfer__title">Subidas</h2>
        {!uploading ? (
          <Button size="sm" variant="ghost" onClick={onClear}>
            Limpiar
          </Button>
        ) : null}
      </div>
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
  );
}
