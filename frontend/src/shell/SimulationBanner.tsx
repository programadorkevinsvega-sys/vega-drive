import { Icon } from "../ui/Icon";

/** Aclara qué partes de la aplicación siguen siendo demostrativas. */
export function SimulationBanner() {
  return <div className="vd-banner" role="note">
    <Icon name="info" size="sm" />
    <p><strong>Autenticación conectada.</strong> Las pantallas y los datos de archivos siguen siendo demostrativos mientras se implementan sus entregas.</p>
  </div>;
}
