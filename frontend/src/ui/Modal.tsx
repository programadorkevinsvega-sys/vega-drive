import { useEffect, useId, useRef, type ReactNode } from "react";
import { IconButton } from "./IconButton";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
}

/**
 * Dialogo modal sobre <dialog>: el navegador aporta el atrapado de foco, la
 * inertizacion del fondo y la devolucion del foco. React sigue siendo la
 * fuente de verdad: Esc y clic en el fondo llaman a onClose.
 * El elemento con data-autofocus recibe el foco inicial (si existe).
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
}: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      dialog.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className="vd-modal"
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="vd-modal__panel">
        <header className="vd-modal__header">
          <h2 id={titleId} className="vd-modal__title">
            {title}
          </h2>
          <IconButton label="Cerrar" icon="close" size="sm" onClick={onClose} />
        </header>
        {description ? (
          <p id={descriptionId} className="vd-modal__desc">
            {description}
          </p>
        ) : null}
        {children ? <div className="vd-modal__body">{children}</div> : null}
        {footer ? <footer className="vd-modal__footer">{footer}</footer> : null}
      </div>
    </dialog>
  );
}
