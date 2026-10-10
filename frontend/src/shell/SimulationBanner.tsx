import { Icon } from "../ui/Icon";

/** Aviso permanente: nada de lo que se ve aqui es real ni se guarda. */
export function SimulationBanner() {
  return (
    <div className="vd-banner" role="note">
      <Icon name="info" size="sm" />
      <p>
        <strong>Vista previa de diseño.</strong> Los datos son simulados: no se
        guarda ni se envía nada.
      </p>
    </div>
  );
}
