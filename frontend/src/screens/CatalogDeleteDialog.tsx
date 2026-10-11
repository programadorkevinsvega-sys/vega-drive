import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import type { FilesCatalogNode } from "../services/files-contract";

interface CatalogDeleteDialogProps {
  target: { node: FilesCatalogNode; trashed: boolean } | null;
  loading: boolean;
  onClose: () => void;
  onSendToTrash: () => void;
  onPermanentDelete: () => void;
}

export function CatalogDeleteDialog({ target, loading, onClose, onSendToTrash, onPermanentDelete }: CatalogDeleteDialogProps) {
  if (!target) return null;
  const { node, trashed } = target;
  const folder = node.type === "folder";
  return (
    <Modal
      open
      onClose={onClose}
      title={trashed ? "Eliminar permanentemente" : "¿Qué deseas hacer?"}
      description={trashed
        ? `“${node.name}” se eliminará de forma irreversible. ${folder ? "También se eliminarán todos los archivos y subcarpetas que contiene." : "El archivo ya no se podrá restaurar."}`
        : `Vas a eliminar “${node.name}”. Puedes enviarlo a la papelera durante 30 días o eliminarlo de forma irreversible.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>Cancelar</Button>
          {!trashed ? <Button variant="secondary" onClick={onSendToTrash} disabled={loading} loading={loading}>Enviar a papelera</Button> : null}
          <Button variant="danger" onClick={onPermanentDelete} disabled={loading} loading={loading}>Eliminar permanentemente</Button>
        </>
      }
    >
      {!trashed ? (
        <div className="vd-modal__note" role="note">
          <p>En la papelera se borrará automáticamente al cumplir 30 días.</p>
          <p>Mientras esté en la papelera, seguirá consumiendo tu espacio de almacenamiento.</p>
          <p>La eliminación permanente no se puede deshacer{folder ? " y elimina también su contenido" : ""}.</p>
        </div>
      ) : (
        <p className="vd-modal__note" role="note">Esta acción no se puede deshacer. El almacenamiento solo se libera cuando la eliminación se completa correctamente.</p>
      )}
    </Modal>
  );
}
