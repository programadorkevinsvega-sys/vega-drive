import { VegaLogo } from "../../brand/VegaLogo";
import { KitButtons } from "./KitButtons";
import { KitColors } from "./KitColors";
import { KitFeedback } from "./KitFeedback";
import { KitFields } from "./KitFields";
import { KitIcons } from "./KitIcons";
import { KitOverlays } from "./KitOverlays";
import { KitTypography } from "./KitTypography";

/**
 * Guia visual TEMPORAL para revisar la base de diseno (#/kit). No forma parte
 * del producto: se retira al integrar (ver INTEGRATION.md).
 */
export function KitScreen() {
  return (
    <div className="vd-page vd-kit">
      <header className="vd-kit__intro">
        <VegaLogo />
        <h1 className="vd-page__title">Guía visual</h1>
        <p className="vd-kit__desc">
          Base de diseño de la Entrega 2. Página de revisión: no es una pantalla
          del producto y no usa datos reales.
        </p>
      </header>
      <KitColors />
      <KitTypography />
      <KitButtons />
      <KitFields />
      <KitOverlays />
      <KitFeedback />
      <KitIcons />
    </div>
  );
}
