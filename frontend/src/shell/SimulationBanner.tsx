import { Icon } from "../ui/Icon";

/** Aclara qué operaciones ya son reales y cuáles siguen pendientes. */
export function SimulationBanner() {
  return (
    <div className="vd-banner" role="note">
      <Icon name="info" size="sm" />
      <p>
        <strong>Sesión y catálogo conectados.</strong> Mi unidad y la papelera
        consultan el servidor. Las subidas de archivos, recientes, favoritos y
        búsqueda siguen pendientes.
      </p>
    </div>
  );
}
