import { Button } from "./Button";
import { Icon } from "./Icon";
import { Modal } from "./Modal";

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  /** Si la accion no es real, el dialogo lo dice de forma explicita. */
  simulated?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Confirmacion de operaciones destructivas. El foco inicial va a "Cancelar". */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel = "Cancelar",
  destructive = false,
  simulated = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      description={message}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} data-autofocus>
            {cancelLabel}
          </Button>
          <Button
            variant={destructive ? "danger" : "primary"}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {simulated ? (
        <p className="vd-modal__note">
          <Icon name="info" size="sm" />
          Acción simulada: no se enviará nada a ningún servidor.
        </p>
      ) : null}
    </Modal>
  );
}
