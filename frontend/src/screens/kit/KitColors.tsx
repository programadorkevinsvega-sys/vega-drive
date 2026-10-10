import { KitSection } from "./KitSection";

const SWATCHES = [
  { key: "bg", label: "Fondo", token: "--vd-bg" },
  { key: "surface", label: "Superficie", token: "--vd-surface" },
  { key: "sunken", label: "Hundido", token: "--vd-surface-sunken" },
  { key: "text", label: "Texto", token: "--vd-text" },
  { key: "muted", label: "Texto secundario", token: "--vd-text-muted" },
  { key: "border", label: "Borde de campo", token: "--vd-border-strong" },
  { key: "accent", label: "Vega (acento)", token: "--vd-accent" },
  { key: "accent-soft", label: "Vega suave", token: "--vd-accent-soft" },
  { key: "danger", label: "Peligro", token: "--vd-danger-solid" },
  { key: "success", label: "Éxito", token: "--vd-success-text" },
  { key: "warning", label: "Simulado / aviso", token: "--vd-warning-soft" },
  { key: "sidebar", label: "Barra lateral", token: "--vd-sidebar-bg" },
] as const;

export function KitColors() {
  return (
    <KitSection
      title="Color"
      description="Tokens semánticos. Cambian con el tema; los valores de contraste se verifican en pruebas."
    >
      <div className="vd-kit__grid">
        {SWATCHES.map((swatch) => (
          <figure className="vd-swatch" key={swatch.key}>
            <div className={`vd-swatch__chip vd-swatch__chip--${swatch.key}`} />
            <figcaption>
              <strong>{swatch.label}</strong>
              <code>{swatch.token}</code>
            </figcaption>
          </figure>
        ))}
      </div>
    </KitSection>
  );
}
