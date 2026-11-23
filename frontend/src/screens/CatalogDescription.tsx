import type { CatalogView } from "./useCatalogData";

interface CatalogDescriptionProps {
  view: CatalogView;
}

export function CatalogDescription({ view }: CatalogDescriptionProps) {
  return (
    <p className="vd-catalog__description">
      {view === "trash"
        ? "Se eliminan automáticamente a los 30 días y siguen ocupando espacio mientras estén aquí."
        : "Carpetas y metadatos sincronizados con tu catálogo privado."}
    </p>
  );
}
