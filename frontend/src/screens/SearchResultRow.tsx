import type { FilesCatalogNode } from "../services/files-service";
import { Icon } from "../ui/Icon";
import { navigate } from "../router/use-route";

export function SearchResultRow({ node }: { node: FilesCatalogNode }) {
  return (
    <div className="vd-catalog__row" role="listitem">
      <div className="vd-catalog__node">
        <Icon name={node.type === "folder" ? "folder" : "file"} size="md" />
        <button
          type="button"
          className="vd-catalog__name"
          onClick={() =>
            node.type === "folder"
              ? navigate({ name: "drive", folderId: node.id })
              : window.location.assign(
                  "/api/files/" + encodeURIComponent(node.id) + "/download",
                )
          }
        >
          {node.name}
        </button>
      </div>
      <span className="vd-catalog__meta">
        {node.type === "folder" ? "Carpeta" : "Archivo"}
      </span>
    </div>
  );
}
