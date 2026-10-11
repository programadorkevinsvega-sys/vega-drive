import { Breadcrumbs, type Crumb } from "../ui/Breadcrumbs";
import { Button } from "../ui/Button";
import { EmptyState } from "../ui/EmptyState";
import { Icon } from "../ui/Icon";
import { Spinner } from "../ui/Spinner";
import { CatalogActionDialog } from "./CatalogActionDialog";
import { CatalogNodeRow } from "./CatalogNodeRow";
import { useCatalogActions } from "./useCatalogActions";
import { useCatalogData, type CatalogView } from "./useCatalogData";
import { navigate } from "../router/use-route";
import { FileTransferControls } from "./FileTransferControls";

export interface FilesCatalogScreenProps {
  view: CatalogView;
  folderId: string | null;
}

export function FilesCatalogScreen({
  view,
  folderId,
}: FilesCatalogScreenProps) {
  const data = useCatalogData(view, folderId);
  const actions = useCatalogActions(folderId, data.refresh);
  const breadcrumbs: Crumb[] =
    view === "trash"
      ? [{ label: "Mi unidad", href: "#/drive" }]
      : folderId !== null
        ? (data.folderData?.breadcrumbs ?? []).slice(0, -1).map((crumb) => ({
            label: crumb.name,
            href: crumb.id === null ? "#/drive" : "#/drive/folder/" + crumb.id,
          }))
        : [];

  return (
    <div className="vd-page vd-catalog">
      {breadcrumbs.length ? <Breadcrumbs items={breadcrumbs} /> : null}
      <header className="vd-catalog__heading">
        <div className="vd-catalog__heading-copy">
          <h1 className="vd-page__title">{data.title}</h1>
          <p className="vd-catalog__description">
            {view === "trash"
              ? "Elementos eliminados de forma reversible. Puedes restaurarlos."
              : "Carpetas y metadatos sincronizados con tu catálogo privado."}
          </p>
        </div>
        {view === "drive" ? (
          <div className="vd-catalog__heading-actions">
            <FileTransferControls
              folderId={folderId}
              onUploaded={data.refresh}
            />
            <Button
              icon="plus"
              onClick={() => actions.setAction({ type: "create-folder" })}
            >
              Nueva carpeta
            </Button>
          </div>
        ) : null}
      </header>

      {data.error ? (
        <div className="vd-catalog__error" role="alert">
          <Icon name="alert" size="sm" />
          <span>{data.error}</span>
          <Button size="sm" variant="secondary" onClick={data.refresh}>
            Reintentar
          </Button>
        </div>
      ) : null}

      {data.loading ? (
        <div className="vd-catalog__loading" role="status">
          <Spinner />
          <span>Cargando desde el servidor…</span>
        </div>
      ) : null}

      {!data.loading && !data.error && data.nodes.length === 0 ? (
        <section className="vd-panel">
          <EmptyState
            icon={view === "trash" ? "trash" : "folder"}
            title={
              view === "trash"
                ? "La papelera está vacía"
                : "Esta carpeta está vacía"
            }
            description={
              view === "trash"
                ? "Los elementos que envíes a la papelera aparecerán aquí."
                : "Sube archivos desde tu equipo o crea carpetas para organizar tu unidad."
            }
            action={
              view === "drive" ? (
                <Button
                  icon="plus"
                  onClick={() => actions.setAction({ type: "create-folder" })}
                >
                  Crear carpeta
                </Button>
              ) : undefined
            }
          />
        </section>
      ) : null}

      {!data.loading && data.nodes.length > 0 ? (
        <section
          className="vd-panel vd-catalog__list"
          role="table"
          aria-label={data.title}
        >
          <div className="vd-catalog__row vd-catalog__row--header" role="row">
            <span role="columnheader">Nombre</span>
            <span role="columnheader">
              {view === "trash" ? "Tipo" : "Tamaño"}
            </span>
            <span role="columnheader">
              {view === "trash" ? "Eliminado" : "Modificado"}
            </span>
            <span role="columnheader" className="vd-catalog__actions-heading">
              Acciones
            </span>
          </div>
          <div role="rowgroup">
            {data.nodes.map((node) => (
              <CatalogNodeRow
                key={node.type + "-" + node.id}
                node={node}
                trashed={view === "trash"}
                onOpen={(id) => navigate({ name: "drive", folderId: id })}
                onRename={(item) =>
                  actions.setAction({ type: "rename", node: item })
                }
                onMove={(item) =>
                  actions.setAction({ type: "move", node: item })
                }
                onDelete={(item) => void actions.deleteNode(item)}
                onRestore={(item) => void actions.restoreNode(item)}
              />
            ))}
          </div>
          {data.nextCursor ? (
            <div className="vd-catalog__load-more">
              <Button
                variant="secondary"
                loading={data.loadingMore}
                disabled={data.loadingMore}
                onClick={() => void data.loadMore()}
              >
                Cargar más
              </Button>
            </div>
          ) : null}
        </section>
      ) : null}

      <CatalogActionDialog
        action={actions.action}
        folders={data.folderTargets}
        onClose={() => actions.setAction(null)}
        onSubmit={actions.submitAction}
      />
    </div>
  );
}
