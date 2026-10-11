import { useEffect, useState } from "react";
import {
  listFolder,
  listTrash,
  FilesApiError,
} from "../services/files-service";
import type {
  FilesCatalogNode,
  FilesFolderListing,
  FilesFolderView,
  FilesTrashListing,
} from "../services/files-contract";

export type CatalogView = "drive" | "trash";

function publicError(cause: unknown): string {
  return cause instanceof FilesApiError
    ? cause.message
    : "No se pudo completar la operación. Inténtalo de nuevo.";
}

export function useCatalogData(view: CatalogView, folderId: string | null) {
  const [folderData, setFolderData] = useState<FilesFolderListing | null>(null);
  const [trashData, setTrashData] = useState<FilesTrashListing | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    setFolderData(null);
    setTrashData(null);
    const task = view === "trash" ? listTrash() : listFolder(folderId);
    void task
      .then((result) => {
        if (cancelled) return;
        if (view === "trash") setTrashData(result as FilesTrashListing);
        else setFolderData(result as FilesFolderListing);
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(publicError(cause));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [view, folderId, refreshKey]);

  const nodes: FilesCatalogNode[] =
    view === "trash"
      ? (trashData?.nodes ?? [])
      : [...(folderData?.folders ?? []), ...(folderData?.files ?? [])];
  const nextCursor =
    view === "trash" ? trashData?.nextCursor : folderData?.nextCursor;
  const folderTargets: FilesFolderView[] = folderData
    ? [...(folderData.folder ? [folderData.folder] : []), ...folderData.folders]
    : [];
  const title =
    view === "trash"
      ? "Papelera"
      : folderId === null
        ? "Mi unidad"
        : (folderData?.folder?.name ?? "Carpeta");

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      if (view === "trash") {
        const next = await listTrash(nextCursor);
        setTrashData((current) =>
          current
            ? { ...next, nodes: [...current.nodes, ...next.nodes] }
            : next,
        );
      } else {
        const next = await listFolder(folderId, nextCursor);
        setFolderData((current) =>
          current
            ? {
                ...next,
                breadcrumbs: current.breadcrumbs,
                folder: current.folder,
                folders: [...current.folders, ...next.folders],
                files: [...current.files, ...next.files],
              }
            : next,
        );
      }
    } catch (cause) {
      setError(publicError(cause));
    } finally {
      setLoadingMore(false);
    }
  }

  return {
    folderData,
    trashData,
    nodes,
    nextCursor,
    folderTargets,
    title,
    loading,
    loadingMore,
    error,
    setError,
    loadMore,
    refresh: () => setRefreshKey((value) => value + 1),
  };
}
