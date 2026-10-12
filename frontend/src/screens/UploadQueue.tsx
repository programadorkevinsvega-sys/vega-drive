import type { ReactNode } from "react";
import { Button } from "../ui/Button";
import { formatFileSize } from "../lib/format-file-size";

export type UploadState =
  | "pending"
  | "uploading"
  | "paused"
  | "cancelled"
  | "completed"
  | "error";

export interface UploadItem {
  id: string;
  file: File;
  state: UploadState;
  progress: number;
  error: string;
  groupId: string;
  folderBatch: boolean;
}

function stateLabel(item: UploadItem): string {
  if (item.state === "pending") return "En espera";
  if (item.state === "uploading") {
    return item.progress > 0
      ? "Subiendo · " + item.progress + "%"
      : "Preparando subida…";
  }
  if (item.state === "paused") return "Pausado · " + item.progress + "%";
  if (item.state === "cancelled") return "Cancelado";
  if (item.state === "completed") return "Completado";
  return "Error al subir";
}

interface UploadQueueProps {
  items: UploadItem[];
  uploading: boolean;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onCancel: (id: string) => void;
  onRemove: (id: string) => void;
  onCancelGroup: (groupId: string) => void;
  onClear: () => void;
}

export function UploadQueue({
  items,
  uploading,
  onPause,
  onResume,
  onCancel,
  onRemove,
  onCancelGroup,
  onClear,
}: UploadQueueProps): ReactNode {
  if (items.length === 0) return null;
  const folderBatch = items.find((item) => item.folderBatch);
  const hasClearable = items.some(
    (item) =>
      item.state === "completed" ||
      item.state === "error" ||
      item.state === "cancelled",
  );

  return (
    <section
      className="vd-transfer__queue"
      aria-label="Progreso de las subidas"
    >
      <div className="vd-transfer__queue-heading">
        <h2 className="vd-transfer__title">Subidas</h2>
        <div className="vd-transfer__queue-heading-actions">
          {folderBatch && uploading ? (
            <Button
              size="sm"
              variant="danger"
              onClick={() => onCancelGroup(folderBatch.groupId)}
            >
              Cancelar carpeta
            </Button>
          ) : null}
          {hasClearable ? (
            <Button size="sm" variant="ghost" onClick={onClear}>
              Limpiar terminadas
            </Button>
          ) : null}
        </div>
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
            <div className="vd-transfer__item-actions">
              {item.state === "uploading" ? (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => onPause(item.id)}
                >
                  Pausar
                </Button>
              ) : null}
              {item.state === "paused" ? (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => onResume(item.id)}
                >
                  Reanudar
                </Button>
              ) : null}
              {item.state === "pending" ||
              item.state === "uploading" ||
              item.state === "paused" ? (
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => onCancel(item.id)}
                >
                  Cancelar
                </Button>
              ) : null}
              {item.state === "pending" ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onRemove(item.id)}
                >
                  Quitar de la cola
                </Button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
