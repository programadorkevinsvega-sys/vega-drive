import { MenuButton, type MenuItem } from "../ui/MenuButton";
import { Icon } from "../ui/Icon";
import type { FilesCatalogNode } from "../services/files-contract";

interface CatalogNodeRowProps {
  node: FilesCatalogNode;
  trashed?: boolean;
  onOpen: (id: string) => void;
  onRename: (node: FilesCatalogNode) => void;
  onMove: (node: FilesCatalogNode) => void;
  onDelete: (node: FilesCatalogNode) => void;
  onRestore: (node: FilesCatalogNode) => void;
}

function formattedSize(size: number): string {
  if (size < 1024) return size + " B";
  if (size < 1024 * 1024) return (size / 1024).toFixed(1) + " KB";
  if (size < 1024 * 1024 * 1024) {
    return (size / (1024 * 1024)).toFixed(1) + " MB";
  }
  return (size / (1024 * 1024 * 1024)).toFixed(1) + " GB";
}

function formattedDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("es-CO", { dateStyle: "medium" }).format(date);
}

export function CatalogNodeRow({
  node,
  trashed = false,
  onOpen,
  onRename,
  onMove,
  onDelete,
  onRestore,
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
      ]
    : [
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
          label: "Enviar a papelera",
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
            isFolder
              ? "vd-catalog__node-icon vd-catalog__node-icon--folder"
              : "vd-catalog__node-icon"
          }
        >
          <Icon name={isFolder ? "folder" : "file"} size="md" />
        </span>
        {isFolder && !trashed ? (
          <button
            type="button"
            className="vd-catalog__name vd-catalog__name--link"
            onClick={() => onOpen(node.id)}
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
