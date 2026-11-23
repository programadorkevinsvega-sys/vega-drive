import { useEffect, useState } from "react";
import { Breadcrumbs } from "../ui/Breadcrumbs";
import { Button } from "../ui/Button";
import { EmptyState } from "../ui/EmptyState";
import { Icon } from "../ui/Icon";
import { Spinner } from "../ui/Spinner";
import {
  listFavorites,
  removeFavorite,
  type FilesFavoriteItem,
} from "../services/files-service";
import { errorLabel } from "./recent-files-format";
import { FavoritesHeading } from "./FavoritesHeading";
import { FavoriteFileRow } from "./FavoriteFileRow";

const DRIVE_HOME = { label: "Mi unidad", href: "#/drive" };

export function FavoritesScreen() {
  const [items, setItems] = useState<FilesFavoriteItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    setItems([]);
    setNextCursor(null);
    void listFavorites()
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
      const result = await listFavorites(nextCursor);
      setItems((current) => [...current, ...result.items]);
      setNextCursor(result.nextCursor);
    } catch (cause) {
      setError(errorLabel(cause));
    } finally {
      setLoadingMore(false);
    }
  }

  async function unFavorite(id: string) {
    if (removing) return;
    setRemoving(id);
    setError("");
    try {
      await removeFavorite(id);
      setItems((current) => current.filter((item) => item.file.id !== id));
    } catch (cause) {
      setError(errorLabel(cause));
    } finally {
      setRemoving(null);
    }
  }

  return (
    <div className="vd-page vd-catalog">
      <Breadcrumbs items={[DRIVE_HOME, { label: "Favoritos" }]} />
      <FavoritesHeading
        loading={loading}
        onRefresh={() => setRefreshKey((value) => value + 1)}
      />
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
          <span>Cargando favoritos…</span>
        </div>
      ) : null}
      {!loading && !error && items.length === 0 ? (
        <section className="vd-panel">
          <EmptyState
            icon="star"
            title="Todavía no tienes favoritos"
            description="Agrega archivos a Favoritos desde el menú de acciones de cada archivo."
          />
        </section>
      ) : null}
      {!loading && items.length > 0 ? (
        <section
          className="vd-panel vd-catalog__list"
          role="table"
          aria-label="Archivos favoritos"
        >
          <div className="vd-catalog__row vd-catalog__row--header" role="row">
            <span role="columnheader">Nombre</span>
            <span role="columnheader">Tipo</span>
            <span role="columnheader">Agregado</span>
            <span role="columnheader" className="vd-catalog__actions-heading">
              Acciones
            </span>
          </div>
          <div role="rowgroup">
            {items.map((item) => (
              <FavoriteFileRow
                key={item.file.id}
                item={item}
                removing={removing === item.file.id}
                disabled={removing !== null}
                onRemove={(id) => void unFavorite(id)}
              />
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
