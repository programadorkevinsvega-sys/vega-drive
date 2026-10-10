import { Button, type ButtonVariant } from "../../ui/Button";
import { IconButton } from "../../ui/IconButton";
import { KitSection } from "./KitSection";

const VARIANTS: ReadonlyArray<[ButtonVariant, string]> = [
  ["primary", "Principal"],
  ["secondary", "Secundario"],
  ["ghost", "Discreto"],
  ["danger", "Peligro"],
];

export function KitButtons() {
  return (
    <KitSection
      title="Botones"
      description="Variantes, tamaños y estados. Cargando bloquea el clic sin perder el foco."
    >
      <div className="vd-kit__row">
        {VARIANTS.map(([variant, label]) => (
          <Button key={variant} variant={variant}>
            {label}
          </Button>
        ))}
      </div>
      <div className="vd-kit__row">
        <Button size="sm" variant="secondary">
          Pequeño
        </Button>
        <Button size="md" variant="secondary">
          Mediano
        </Button>
        <Button size="lg" variant="secondary">
          Grande
        </Button>
        <Button icon="plus" variant="secondary">
          Con icono
        </Button>
      </div>
      <div className="vd-kit__row">
        <Button disabled>Deshabilitado</Button>
        <Button loading>Cargando</Button>
        <Button variant="secondary" loading>
          Cargando
        </Button>
        <Button variant="danger" disabled>
          Eliminar
        </Button>
      </div>
      <div className="vd-kit__row">
        <IconButton
          label="Cuadrícula"
          icon="grid"
          variant="secondary"
          pressed
        />
        <IconButton
          label="Lista"
          icon="list"
          variant="secondary"
          pressed={false}
        />
        <IconButton label="Favorito" icon="star" />
        <IconButton label="Más acciones" icon="more" size="sm" />
      </div>
    </KitSection>
  );
}
