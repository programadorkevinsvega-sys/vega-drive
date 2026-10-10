import { Badge } from "../../ui/Badge";
import { Breadcrumbs } from "../../ui/Breadcrumbs";
import { Button } from "../../ui/Button";
import { EmptyState } from "../../ui/EmptyState";
import { Spinner } from "../../ui/Spinner";
import { KitSection } from "./KitSection";

export function KitFeedback() {
  return (
    <KitSection
      title="Estados y navegación"
      description="Insignias, indicador de carga, estado vacío y ruta de navegación."
    >
      <div className="vd-kit__row">
        <Badge>Neutro</Badge>
        <Badge tone="accent">Acento</Badge>
        <Badge tone="success">Correcto</Badge>
        <Badge tone="warning">Simulado</Badge>
        <Badge tone="danger">Error</Badge>
        <Spinner label="Cargando" />
      </div>
      <Breadcrumbs
        items={[
          { label: "Mi unidad", href: "#/drive" },
          { label: "Proyectos", href: "#/drive" },
          { label: "Diseño" },
        ]}
      />
      <div className="vd-panel">
        <EmptyState
          icon="folder"
          headingLevel={3}
          title="Esta carpeta está vacía"
          description="Aquí aparecerán los archivos y carpetas que añadas."
          action={<Button icon="upload" variant="secondary">Subir archivos</Button>}
        />
      </div>
    </KitSection>
  );
}
