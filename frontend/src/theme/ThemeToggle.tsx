import { Icon, type IconName } from "../ui/Icon";
import { iconButtonClass } from "../ui/IconButton";
import { MenuButton, type MenuItem } from "../ui/MenuButton";
import type { ThemePreference } from "./theme";
import { useTheme } from "./ThemeProvider";

const OPTIONS: ReadonlyArray<{
  value: ThemePreference;
  label: string;
  icon: IconName;
}> = [
  { value: "light", label: "Claro", icon: "sun" },
  { value: "dark", label: "Oscuro", icon: "moon" },
  { value: "system", label: "Igual que el sistema", icon: "monitor" },
];

export function ThemeToggle() {
  const { preference, resolved, setPreference } = useTheme();
  const items: MenuItem[] = OPTIONS.map((option) => ({
    id: option.value,
    label: option.label,
    icon: option.icon,
    checked: preference === option.value,
    onSelect: () => setPreference(option.value),
  }));

  return (
    <MenuButton
      label="Tema de la interfaz"
      items={items}
      triggerClassName={iconButtonClass("ghost", "md")}
    >
      <Icon name={resolved === "dark" ? "moon" : "sun"} />
    </MenuButton>
  );
}
