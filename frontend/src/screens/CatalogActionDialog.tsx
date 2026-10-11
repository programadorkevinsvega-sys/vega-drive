import { useEffect, useId, useState, type FormEvent } from "react";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import { TextField } from "../ui/TextField";
import type {
  FilesCatalogNode,
  FilesFolderView,
} from "../services/files-contract";

export type CatalogAction =
  | { type: "create-folder" }
  | { type: "rename"; node: FilesCatalogNode }
  | { type: "move"; node: FilesCatalogNode };

interface CatalogActionDialogProps {
  action: CatalogAction | null;
  folders: FilesFolderView[];
  onClose: () => void;
  onSubmit: (value: string) => Promise<void>;
}

export function CatalogActionDialog({
  action,
  folders,
  onClose,
  onSubmit,
}: CatalogActionDialogProps) {
  const formId = useId();
  const targetId = useId();
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setName(action?.type === "rename" ? action.node.name : "");
    setTarget(
      action?.type === "move"
        ? action.node.type === "folder"
          ? (action.node.parentFolderId ?? "")
          : (action.node.folderId ?? "")
        : "",
    );
    setError("");
  }, [action]);

  if (!action) return null;
  const moving = action.type === "move";
  const renaming = action.type === "rename";
  const title =
    action.type === "create-folder"
      ? "Nueva carpeta"
      : moving
        ? "Mover elemento"
        : "Renombrar elemento";
  const nodeName = action.type === "create-folder" ? "" : action.node.name;
  const availableFolders = folders.filter(
    (folder) => action.type !== "move" || folder.id !== action.node.id,
  );

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!moving && !name.trim()) {
      setError("Escribe un nombre para continuar.");
      return;
    }
    setLoading(true);
    try {
      await onSubmit(moving ? target : name.trim());
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "No se pudo completar la operación.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      description={
        moving
          ? "Elige dónde quedará " +
            nodeName +
            ". El servidor validará la propiedad y los ciclos de carpetas."
          : renaming
            ? "El nombre se actualizará en el catálogo del servidor."
            : "La carpeta se creará en la ubicación que estás viendo."
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form={formId}
            loading={loading}
            disabled={loading}
          >
            {moving ? "Mover" : renaming ? "Guardar nombre" : "Crear carpeta"}
          </Button>
        </>
      }
    >
      <form id={formId} className="vd-catalog__form" onSubmit={submit}>
        {moving ? (
          <div className="vd-field">
            <label className="vd-field__label" htmlFor={targetId}>
              Carpeta de destino
            </label>
            <select
              id={targetId}
              className="vd-field__input"
              value={target}
              onChange={(event) => setTarget(event.target.value)}
              disabled={loading}
            >
              <option value="">Mi unidad (raíz)</option>
              {availableFolders.map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {folder.name}
                </option>
              ))}
            </select>
            <p className="vd-field__hint">
              Se muestran las carpetas de la ubicación actual. La autorización y
              la prevención de ciclos se comprueban en el servidor.
            </p>
          </div>
        ) : (
          <TextField
            label="Nombre"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={255}
            autoComplete="off"
            autoFocus
            required
            disabled={loading}
          />
        )}
        {error ? (
          <p className="vd-catalog__form-error" role="alert">
            {error}
          </p>
        ) : null}
      </form>
    </Modal>
  );
}
