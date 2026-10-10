import { Icon } from "../../ui/Icon";
import { ICON_NAMES } from "../../ui/icon-paths";
import { KitSection } from "./KitSection";

export function KitIcons() {
  return (
    <KitSection
      title="Iconos"
      description="Conjunto propio de trazo uniforme; decorativos por defecto."
    >
      <ul className="vd-kit__icons">
        {ICON_NAMES.map((name) => (
          <li key={name}>
            <Icon name={name} size="lg" />
            <code>{name}</code>
          </li>
        ))}
      </ul>
    </KitSection>
  );
}
