import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import { CatalogActionDialog } from "./CatalogActionDialog";
import { CatalogDeleteDialog } from "./CatalogDeleteDialog";
import { useCatalogActions } from "./useCatalogActions";
import { useCatalogData } from "./useCatalogData";

interface CatalogDialogsProps {
  actions: ReturnType<typeof useCatalogActions>;
  folderTargets: ReturnType<typeof useCatalogData>["folderTargets"];
  emptyTrashOpen: boolean;
  setEmptyTrashOpen: (open: boolean) => void;
}

export function CatalogDialogs({
  actions,
  folderTargets,
  emptyTrashOpen,
  setEmptyTrashOpen,
}: CatalogDialogsProps) {

  return (
        <Modal
          open={emptyTrashOpen}
          onClose={() => {
            if (!actions.emptyTrashLoading) setEmptyTrashOpen(false);
          }}
          title="¿Vaciar toda la papelera?"
          description="Se eliminarán permanentemente todos los archivos y carpetas de la papelera. Esta acción no se puede deshacer."
          footer={
            <>
              <Button
                variant="secondary"
                onClick={() => setEmptyTrashOpen(false)}
                disabled={actions.emptyTrashLoading}
              >
                Cancelar
              </Button>
              <Button
                variant="danger"
                icon="trash"
                loading={actions.emptyTrashLoading}
                disabled={actions.emptyTrashLoading}
                onClick={async () => {
                  if (await actions.emptyTrash()) setEmptyTrashOpen(false);
                }}
              >
                Vaciar papelera
              </Button>
            </>
          }
        >
          <p className="vd-modal__note" role="note">
            Se borrarán también los contenidos de las carpetas. Los archivos que
            no se puedan eliminar por un error del servidor permanecerán en la
            papelera para que puedas volver a intentarlo.
          </p>
        </Modal>
  
        <CatalogActionDialog
          action={actions.action}
          folders={folderTargets}
          onClose={() => actions.setAction(null)}
          onSubmit={actions.submitAction}
        />
        <CatalogDeleteDialog
          target={actions.deleteTarget}
          loading={actions.deleteLoading}
          onClose={actions.closeDeleteDialog}
          onSendToTrash={actions.sendToTrash}
          onPermanentDelete={actions.permanentlyDelete}
        />
  );
}
