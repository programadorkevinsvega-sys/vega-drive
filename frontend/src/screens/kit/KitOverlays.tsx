import { useState } from "react";
import { navigate } from "../../router/use-route";
import { Button } from "../../ui/Button";
import { ConfirmDialog } from "../../ui/ConfirmDialog";
import { MenuButton, type MenuItem } from "../../ui/MenuButton";
import { Modal } from "../../ui/Modal";
import { useToast } from "../../ui/toast-context";
import { iconButtonClass } from "../../ui/IconButton";
import { Icon } from "../../ui/Icon";
import { KitSection } from "./KitSection";

export function KitOverlays() {
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { notify, notifySimulated } = useToast();

  const items: MenuItem[] = [
    { id: "open", label: "Abrir", icon: "folder", onSelect: () => navigate({ name: "drive", folderId: null }) },
    { id: "star", label: "Añadir a favoritos", icon: "star", onSelect: () => notifySimulated({ tone: "success", title: "Marcado como favorito" }) },
    { id: "move", label: "Mover (no disponible)", icon: "folder", disabled: true, onSelect: () => undefined },
    { id: "trash", label: "Mover a la papelera", icon: "trash", danger: true, onSelect: () => setConfirmOpen(true) },
  ];

  return (
    <KitSection
      title="Menús, diálogos y notificaciones"
      description="Menú con teclado (flechas, Inicio, Fin, Esc), diálogo nativo con foco atrapado y avisos accesibles."
    >
      <div className="vd-kit__row">
        <MenuButton label="Más acciones" items={items} align="start" triggerClassName={iconButtonClass("secondary", "md")}>
          <Icon name="more" />
        </MenuButton>
        <Button variant="secondary" onClick={() => setModalOpen(true)}>Abrir diálogo</Button>
        <Button variant="danger" onClick={() => setConfirmOpen(true)}>Confirmar eliminación</Button>
      </div>
      <div className="vd-kit__row">
        <Button variant="secondary" onClick={() => notify({ tone: "info", title: "Aviso informativo", description: "Se cierra solo; se pausa al pasar el puntero." })}>Aviso</Button>
        <Button variant="secondary" onClick={() => notify({ tone: "success", title: "Cambios aplicados" })}>Éxito</Button>
        <Button variant="secondary" onClick={() => notify({ tone: "error", title: "No se pudo completar", description: "Los errores permanecen más tiempo." })}>Error</Button>
        <Button variant="secondary" onClick={() => notifySimulated({ tone: "info", title: "Subida simulada", description: "No se subió ningún archivo." })}>Simulado</Button>
      </div>
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Título del diálogo"
        description="Descripción breve de lo que se pide al usuario."
        footer={<Button onClick={() => setModalOpen(false)} data-autofocus>Entendido</Button>}
      />
      <ConfirmDialog
        open={confirmOpen}
        title="¿Mover a la papelera?"
        message="El elemento dejará de verse en Mi unidad."
        confirmLabel="Mover a la papelera"
        destructive
        simulated
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false);
          notifySimulated({ tone: "success", title: "Eliminación simulada", description: "No se eliminó nada." });
        }}
      />
    </KitSection>
  );
}
