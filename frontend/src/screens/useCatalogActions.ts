import { useState } from "react";
import {
  createFolder, deleteFile, deleteFilePermanently, deleteFolder, deleteFolderPermanently,
  FilesApiError, moveFile, moveFolder, renameFile, renameFolder, restoreFile, restoreFolder,
} from "../services/files-service";
import type { FilesCatalogNode } from "../services/files-contract";
import { useToast } from "../ui/toast-context";
import type { CatalogAction } from "./CatalogActionDialog";

function publicError(cause: unknown): string {
  return cause instanceof FilesApiError ? cause.message : "No se pudo completar la operación. Inténtalo de nuevo.";
}

export function useCatalogActions(folderId: string | null, refresh: () => void) {
  const [action, setAction] = useState<CatalogAction | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ node: FilesCatalogNode; trashed: boolean } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const { notify } = useToast();

  async function submitAction(value: string) {
    if (!action) return;
    if (action.type === "create-folder") await createFolder(value, folderId);
    else if (action.type === "rename") {
      if (action.node.type === "folder") await renameFolder(action.node.id, value);
      else await renameFile(action.node.id, value);
    } else if (action.node.type === "folder") await moveFolder(action.node.id, value || null);
    else await moveFile(action.node.id, value || null);
    const completed = action.type;
    setAction(null);
    notify({ tone: "success", title: completed === "create-folder" ? "Carpeta creada" : completed === "rename" ? "Nombre actualizado" : "Elemento movido", description: "Los cambios se guardaron en el catálogo del servidor." });
    refresh();
  }

  function requestDelete(node: FilesCatalogNode, trashed = false) {
    setDeleteTarget({ node, trashed });
  }

  async function finishDelete(permanent: boolean) {
    if (!deleteTarget || deleteLoading) return;
    setDeleteLoading(true);
    const { node } = deleteTarget;
    try {
      if (permanent) {
        if (node.type === "folder") await deleteFolderPermanently(node.id);
        else await deleteFilePermanently(node.id);
      } else if (node.type === "folder") await deleteFolder(node.id);
      else await deleteFile(node.id);
      setDeleteTarget(null);
      notify({
        tone: "success",
        title: permanent ? "Elemento eliminado permanentemente" : "Elemento enviado a la papelera",
        description: permanent ? "El elemento y su contenido almacenado se eliminaron." : "Se eliminará automáticamente después de 30 días. Seguirá ocupando espacio hasta entonces.",
      });
      refresh();
    } catch (cause) {
      notify({ tone: "error", title: "No se pudo eliminar", description: publicError(cause) });
    } finally {
      setDeleteLoading(false);
    }
  }

  async function restoreNode(node: FilesCatalogNode) {
    try {
      if (node.type === "folder") await restoreFolder(node.id);
      else await restoreFile(node.id);
      notify({ tone: "success", title: "Elemento restaurado", description: "El elemento volvió a estar disponible en Mi unidad." });
      refresh();
    } catch (cause) {
      notify({ tone: "error", title: "No se pudo restaurar", description: publicError(cause) });
    }
  }

  return {
    action, setAction, submitAction, requestDelete, deleteTarget, deleteLoading,
    sendToTrash: () => finishDelete(false),
    permanentlyDelete: () => finishDelete(true),
    closeDeleteDialog: () => { if (!deleteLoading) setDeleteTarget(null); },
    restoreNode,
  };
}
