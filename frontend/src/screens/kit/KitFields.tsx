import { Button } from "../../ui/Button";
import { TextField } from "../../ui/TextField";
import { KitSection } from "./KitSection";

export function KitFields() {
  return (
    <KitSection
      title="Campos"
      description="Etiqueta siempre visible, ayuda y error enlazados con aria-describedby."
    >
      <div className="vd-kit__fields">
        <TextField label="Nombre de carpeta" placeholder="Documentos" />
        <TextField
          label="Correo electrónico"
          type="email"
          hint="Texto de ayuda bajo el campo."
          required
        />
        <TextField
          label="Nombre de archivo"
          defaultValue="informe/final"
          error="El nombre no puede contener «/»."
        />
        <TextField label="Campo deshabilitado" disabled defaultValue="Solo lectura" />
        <TextField
          label="Con acción al final"
          type="password"
          defaultValue="ejemplo"
          trailing={<Button size="sm" variant="ghost">Mostrar</Button>}
        />
      </div>
    </KitSection>
  );
}
