import { VegaMark } from "./VegaMark";

export interface VegaLogoProps {
  /** Muestra solo el simbolo (el nombre accesible se conserva). */
  compact?: boolean;
}

export function VegaLogo({ compact = false }: VegaLogoProps) {
  return (
    <span className="vd-logo">
      <VegaMark />
      {compact ? (
        <span className="vd-sr-only">Vega Drive</span>
      ) : (
        <span className="vd-logo__word">
          <span className="vd-logo__vega">Vega</span>
          <span className="vd-logo__drive">Drive</span>
        </span>
      )}
    </span>
  );
}
