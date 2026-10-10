import { KitSection } from "./KitSection";

export function KitTypography() {
  return (
    <KitSection
      title="Tipografía"
      description="Pila del sistema (la CSP bloquea fuentes externas). Escala de 7 pasos."
    >
      <div className="vd-kit__type">
        <p className="vd-t-3xl">Archivos privados, en orden</p>
        <p className="vd-t-2xl">Título de pantalla</p>
        <p className="vd-t-xl">Título de sección</p>
        <p className="vd-t-lg">Texto destacado de introducción</p>
        <p className="vd-t-base">
          Texto base: legible, con interlineado cómodo y líneas de menos de 80
          caracteres para lectura prolongada.
        </p>
        <p className="vd-t-sm">
          Texto pequeño para metadatos y ayudas de campo.
        </p>
        <p className="vd-t-xs">Texto mínimo para etiquetas de estado.</p>
      </div>
    </KitSection>
  );
}
