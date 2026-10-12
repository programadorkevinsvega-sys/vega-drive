import { useEffect, useState } from "react";
import { Breadcrumbs } from "../ui/Breadcrumbs";
import { Button } from "../ui/Button";
import { EmptyState } from "../ui/EmptyState";
import { Icon } from "../ui/Icon";
import { Spinner } from "../ui/Spinner";
import { formatFileSize } from "../lib/format-file-size";
import {
  FilesApiError,
  listRecent,
  downloadFileUrl,
  type FilesRecentItem,
} from "../services/files-service";

const DRIVE_HOME = { label: "Mi unidad", href: "#/drive" };

function dateLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function errorLabel(cause: unknown): string {
  return cause instanceof FilesApiError
    ? cause.message
    : "No se pudieron cargar los archivos recientes. Inténtalo de nuevo.";
}

export function RecentFilesScreen() {
  const [items, setItems] = useState<FilesRecentItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    setItems([]);
    setNextCursor(null);
    void listRecent()
      .then((result) => {
        if (cancelled) return;
        setItems(result.items);
        setNextCursor(result.nextCursor);
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(errorLabel(cause));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    setError("");
    try {
      const result = await listRecent(nextCursor);
      setItems((current) => [...current, ...result.items]);
      setNextCursor(result.nextCursor);
    } catch (cause) {
      setError(errorLabel(cause));
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <div className="vd-page vd-catalog">
      <Breadcrumbs items={[DRIVE_HOME, { label: "Recientes" }]} />
      <header className="vd-catalog__heading">
        <div className="vd-catalog__heading-copy">
          <h1 className="vd-page__title">Recientes</h1>
          <p className="vd-catalog__description">
            Archivos ordenados por la última apertura o descarga registrada.
          </p>
        </div>
        <Button
          icon="refresh-cw"
          variant="secondary"
          onClick={() => setRefreshKey((value) => value + 1)}
          disabled={loading}
        >
          Actualizar
        </Button>
      </header>

      {error ? (
        <div className="vd-catalog__error" role="alert">
          <Icon name="alert" size="sm" />
          <span>{error}</span>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setRefreshKey((value) => value + 1)}
          >
            Reintentar
          </Button>
        </div>
      ) : null}

      {loading ? (
        <div className="vd-catalog__loading" role="status">
          <Spinner />
          <span>Cargando actividad reciente…</span>
        </div>
      ) : null}

      {!loading && !error && items.length === 0 ? (
        <section className="vd-panel">
          <EmptyState
            icon="clock"
            title="Todavía no hay actividad reciente"
            description="Los archivos aparecerán aquí cuando abras uno desde una vista compatible o inicies una descarga."
          />
        </section>
      ) : null}

      {!loading && items.length > 0 ? (
        <section
          className="vd-panel vd-catalog__list"
          role="table"
          aria-label="Archivos recientes"
        >
          <div className="vd-catalog__row vd-catalog__row--header" role="row">
            <span role="columnheader">Nombre</span>
            <span role="columnheader">Tamaño</span>
            <span role="columnheader">Actividad</span>
            <span role="columnheader">Fecha</span>
            <span role="columnheader" className="vd-catalog__actions-heading">
              Acciones
            </span>
          </div>
          <div role="rowgroup">
            {items.map((item) => (
              <div className="vd-catalog__row" role="row" key={item.file.id}>
                <div className="vd-catalog__node" role="cell">
                  <span className="vd-catalog__node-icon">
                    <Icon name="file" size="md" />
                  </span>
                  <span className="vd-catalog__name" title={item.file.name}>
                    {item.file.name}
                  </span>
                </div>
                <span className="vd-catalog__meta" role="cell">
                  {formatFileSize(item.file.sizeBytes)}
                </span>
                <span className="vd-catalog__meta" role="cell">
                  {item.activityType === "open" ? "Apertura" : "Descarga"}
                </span>
                <span className="vd-catalog__meta" role="cell">
                  {dateLabel(item.lastActivityAt)}
                </span>
                <div className="vd-catalog__actions" role="cell">
                  <Button
                    size="sm"
                    variant="secondary"
                    icon="download"
                    onClick={() =>
                      window.location.assign(downloadFileUrl(item.file.id))
                    }
                  >
                    Descargar
                  </Button>
                </div>
              </div>
            ))}
          </div>
          {nextCursor ? (
            <div className="vd-catalog__load-more">
              <Button
                variant="secondary"
                loading={loadingMore}
                disabled={loadingMore}
                onClick={() => void loadMore()}
              >
                Cargar más
              </Button>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
