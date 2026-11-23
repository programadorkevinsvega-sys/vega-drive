import { Button } from "../ui/Button";
import { Icon } from "../ui/Icon";
import {
  downloadFileUrl,
  type FilesFavoriteItem,
} from "../services/files-service";
import { RecentFilePreviewAction } from "./RecentFilePreviewAction";
import {
  fileTypeIcon,
  fileTypeLabel,
  fileVisualType,
} from "../lib/file-type-icon";
import { dateLabel } from "./recent-files-format";

interface FavoriteFileRowProps {
  item: FilesFavoriteItem;
  removing: boolean;
  disabled: boolean;
  onRemove: (id: string) => void;
}

export function FavoriteFileRow({
  item,
  removing,
  disabled,
  onRemove,
}: FavoriteFileRowProps) {
  return (
    <div className="vd-catalog__row" role="row">
      <div className="vd-catalog__node" role="cell">
        <span
          className={
            "vd-catalog__node-icon vd-catalog__node-icon--" +
            fileVisualType(item.file.name)
          }
          title={fileTypeLabel(item.file.name)}
          aria-hidden="true"
        >
          <Icon name={fileTypeIcon(item.file.name)} size="md" />
        </span>
        <span className="vd-catalog__name" title={item.file.name}>
          {item.file.name}
        </span>
      </div>
      <span className="vd-catalog__meta" role="cell">
        {fileTypeLabel(item.file.name)}
      </span>
      <span className="vd-catalog__meta" role="cell">
        {dateLabel(item.favoritedAt)}
      </span>
      <div className="vd-catalog__actions" role="cell">
        <RecentFilePreviewAction file={item.file} />
        <Button
          size="sm"
          variant="secondary"
          onClick={() => window.location.assign(downloadFileUrl(item.file.id))}
        >
          Descargar
        </Button>
        <Button
          size="sm"
          variant="ghost"
          icon="star"
          loading={removing}
          disabled={disabled}
          aria-label={"Quitar " + item.file.name + " de Favoritos"}
          onClick={() => onRemove(item.file.id)}
        >
          Quitar
        </Button>
      </div>
    </div>
  );
}
