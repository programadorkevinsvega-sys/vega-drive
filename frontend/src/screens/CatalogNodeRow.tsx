import { MenuButton, type MenuItem } from "../ui/MenuButton";
import { Icon } from "../ui/Icon";
import { formatFileSize } from "../lib/format-file-size";
import {
  fileTypeIcon,
  fileTypeLabel,
  fileVisualType,
} from "../lib/file-type-icon";
import { downloadFileUrl } from "../services/files-service";
import { canPreviewFile } from "./preview-format";
import type { FilesCatalogNode } from "../services/files-contract";

interface CatalogNodeRowProps {
  node: FilesCatalogNode;
  trashed?: boolean;
  onOpen: (id: string) => void;
  onPreview: (node: Extract<FilesCatalogNode, { type: "file" }>) => void;
  onRename: (node: FilesCatalogNode) => void;
  onMove: (node: FilesCatalogNode) => void;
  onDelete: (node: FilesCatalogNode) => void;
  onPermanentDelete: (node: FilesCatalogNode) => void;
  onRestore: (node: FilesCatalogNode) => void;
  onFavorite: (node: Extract<FilesCatalogNode, { type: "file" }>) => void;
  onShare: (node: Extract<FilesCatalogNode, { type: "file" }>) => void;
}

function formattedSize(size: number): string {
  return formatFileSize(size);
}

function formattedDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
  }).format(date);
}

export function CatalogNodeRow({
  node,
  trashed = false,
  onOpen,
  onPreview,
  onRename,
  onMove,
  onDelete,
  onPermanentDelete,
  onRestore,
  onFavorite,
}: CatalogNodeRowProps) {
  const isFolder = node.type === "folder";
  const size = trashed
    ? isFolder
      ? "Carpeta"
      : "Archivo"
    : isFolder
      ? "Carpeta"
      : formattedSize(node.sizeBytes);
  const date = formattedDate(trashed ? node.deletedAt : node.updatedAt);
  const items: MenuItem[] = trashed
    ? [
        {
          id: "restore",
          label: "Restaurar",
          icon: "undo",
          onSelect: () => onRestore(node),
        },
        {
          id: "permanent-delete",
          label: "Eliminar permanentemente",
          icon: "trash",
          danger: true,
          onSelect: () => onPermanentDelete(node),
        },
      ]
    : [
        ...(!isFolder && canPreviewFile(node.name)
          ? [
              {
                id: "preview",
                label: "Vista previa",
                icon: "file",
                onSelect: () =>
                  onPreview(
                    node as Extract<FilesCatalogNode, { type: "file" }>,
                  ),
              } satisfies MenuItem,
            ]
          : []),
        ...(!isFolder
          ? [
              {
                id: "favorite",
                label: "Agregar a Favoritos",
                icon: "star",
                onSelect: () =>
                  onFavorite(
                    node as Extract<FilesCatalogNode, { type: "file" }>,
                  ),
              } satisfies MenuItem,
              {
                id: "download",
                label: "Descargar",
                onSelect: () =>
                  window.location.assign(downloadFileUrl(node.id)),
              } satisfies MenuItem,
            ]
          : []),
        {
          id: "rename",
          label: "Renombrar",
          icon: "edit",
          onSelect: () => onRename(node),
        },
        {
          id: "move",
          label: "Mover",
          icon: "folder",
          onSelect: () => onMove(node),
        },
        {
          id: "delete",
          label: "Eliminar",
          icon: "trash",
          danger: true,
          onSelect: () => onDelete(node),
        },
      ];

  return (
    <div className="vd-catalog__row" role="row">
      <div className="vd-catalog__node" role="cell">
        <span
          className={
            "vd-catalog__node-icon vd-catalog__node-icon--" +
            (isFolder ? "folder" : fileVisualType(node.name))
          }
          title={isFolder ? "Carpeta" : fileTypeLabel(node.name)}
          aria-hidden="true"
        >
          <Icon
            name={isFolder ? "folder" : fileTypeIcon(node.name)}
            size="md"
          />
        </span>
        {isFolder && !trashed ? (
          <button
            type="button"
            className="vd-catalog__name vd-catalog__name--link"
            onClick={() => onOpen(node.id)}
          >
            {node.name}
          </button>
        ) : !isFolder && !trashed && canPreviewFile(node.name) ? (
          <button
            type="button"
            className="vd-catalog__name vd-catalog__name--link"
            onClick={() => onPreview(node)}
          >
            {node.name}
          </button>
        ) : (
          <span className="vd-catalog__name" title={node.name}>
            {node.name}
          </span>
        )}
      </div>
      <span className="vd-catalog__meta" role="cell">
        {size}
      </span>
      <span className="vd-catalog__meta" role="cell">
        {date}
      </span>
      <div className="vd-catalog__actions" role="cell">
        <MenuButton
          label={"Acciones para " + node.name}
          items={items}
          triggerClassName="vd-iconbtn vd-iconbtn--sm"
        >
          <Icon name="more" size="md" />
        </MenuButton>
      </div>
    </div>
  );
}

export { formattedSize };
