import { Icon } from "../ui/Icon";

/** Aclara qué operaciones ya son reales y cuáles siguen pendientes. */
export function SimulationBanner() {
  return (
    <div className="vd-banner" role="note">
      <Icon name="info" size="sm" />
      <p>
        <strong>Sesión, catálogo y transferencias conectados.</strong> Mi unidad
        y la papelera consultan el servidor; las subidas y descargas pasan por
        el Worker privado. Recientes, favoritos y búsqueda siguen pendientes.
      </p>
    </div>
  );
}
