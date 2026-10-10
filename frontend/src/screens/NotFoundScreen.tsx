import { EmptyState } from "../ui/EmptyState";

export function NotFoundScreen() {
  return (
    <div className="vd-page">
      <h1 className="vd-page__title">Página no encontrada</h1>
      <section className="vd-panel" aria-label="Página no encontrada">
        <EmptyState
          icon="search"
          title="No existe esta dirección"
          description="Revisa el enlace o vuelve a Mi unidad."
          action={
            <a className="vd-btn vd-btn--secondary vd-btn--md" href="#/drive">
              Ir a Mi unidad
            </a>
          }
        />
      </section>
    </div>
  );
}
