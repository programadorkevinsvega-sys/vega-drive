import { useEffect, useState, type FormEvent } from "react";
import { Breadcrumbs } from "../ui/Breadcrumbs";
import { Button } from "../ui/Button";
import { EmptyState } from "../ui/EmptyState";
import { Icon } from "../ui/Icon";
import { Spinner } from "../ui/Spinner";
import { searchFiles, type FilesCatalogNode } from "../services/files-service";
import { errorLabel } from "./recent-files-format";
import { SearchResultRow } from "./SearchResultRow";
import { navigate } from "../router/use-route";

const DRIVE_HOME = { label: "Mi unidad", href: "#/drive" };
type SearchType = "all" | "files" | "folders";

export function SearchScreen({ initialQuery }: { initialQuery: string }) {
  const [query, setQuery] = useState(initialQuery);
  const [type, setType] = useState<SearchType>("all");
  const [nodes, setNodes] = useState<FilesCatalogNode[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(initialQuery);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    setQuery(initialQuery);
    setSubmitted(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    let cancelled = false;
    setNodes([]);
    setNextCursor(null);
    setError("");

    if (!submitted.trim()) {
      setLoading(false);
      return;
    }

    setLoading(true);
    void searchFiles(submitted, type)
      .then((result) => {
        if (!cancelled) {
          setNodes(result.nodes);
          setNextCursor(result.nextCursor);
        }
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
  }, [submitted, type, refreshKey]);

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    setError("");

    try {
      const result = await searchFiles(submitted, type, nextCursor);
      setNodes((current) => [...current, ...result.nodes]);
      setNextCursor(result.nextCursor);
    } catch (cause) {
      setError(errorLabel(cause));
    } finally {
      setLoadingMore(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = query.trim().slice(0, 200);
    setQuery(value);
    setSubmitted(value);
    navigate({ name: "search", query: value });
  }

  return (
    <div className="vd-page vd-catalog">
      <Breadcrumbs items={[DRIVE_HOME, { label: "Búsqueda" }]} />
      <header className="vd-catalog__heading">
        <div className="vd-catalog__heading-copy">
          <h1 className="vd-page__title">Búsqueda</h1>
          <p className="vd-catalog__description">
            Busca archivos y carpetas de tu unidad por nombre.
          </p>
        </div>
      </header>

      <form onSubmit={submit} className="vd-panel" role="search">
        <label htmlFor="files-search-query">Nombre del archivo o carpeta</label>
        <div className="vd-catalog__heading-actions">
          <input
            id="files-search-query"
            type="search"
            value={query}
            maxLength={200}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Escribe un nombre…"
          />
          <select
            aria-label="Tipo de resultado"
            value={type}
            onChange={(event) => setType(event.target.value as SearchType)}
          >
            <option value="all">Todos</option>
            <option value="files">Archivos</option>
            <option value="folders">Carpetas</option>
          </select>
          <Button type="submit" disabled={!query.trim()}>
            Buscar
          </Button>
        </div>
      </form>

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
          <span>Buscando en tu unidad…</span>
        </div>
      ) : null}

      {!loading && !error && submitted && nodes.length === 0 ? (
        <section className="vd-panel">
          <EmptyState
            icon="search"
            title="No se encontraron resultados"
            description="Prueba con otro nombre o cambia el tipo de resultado."
          />
        </section>
      ) : null}

      {!submitted ? (
        <section className="vd-panel">
          <EmptyState
            icon="search"
            title="Busca en tu unidad"
            description="Escribe parte del nombre de un archivo o carpeta para encontrarlo."
          />
        </section>
      ) : null}

      {!loading && nodes.length > 0 ? (
        <section
          className="vd-panel vd-catalog__list"
          role="list"
          aria-label="Resultados de búsqueda"
        >
          {nodes.map((node) => (
            <SearchResultRow key={node.type + "-" + node.id} node={node} />
          ))}

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
