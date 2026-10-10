import type { IconName } from "../ui/Icon";
import type { Route } from "../router/routes";

export interface NavItem {
  to: Route;
  label: string;
  icon: IconName;
}

export const PRIMARY_NAV: readonly NavItem[] = [
  { to: { name: "drive", folderId: null }, label: "Mi unidad", icon: "drive" },
  { to: { name: "recent" }, label: "Recientes", icon: "clock" },
  { to: { name: "favorites" }, label: "Favoritos", icon: "star" },
  { to: { name: "trash" }, label: "Papelera", icon: "trash" },
];

export const SETTINGS_NAV: NavItem = {
  to: { name: "settings" },
  label: "Ajustes",
  icon: "settings",
};
