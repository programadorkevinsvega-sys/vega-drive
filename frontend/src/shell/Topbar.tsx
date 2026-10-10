import type { Route } from "../router/routes";
import { ThemeToggle } from "../theme/ThemeToggle";
import { IconButton } from "../ui/IconButton";
import { ProfileMenu } from "./ProfileMenu";
import { SearchBox } from "./SearchBox";

export interface TopbarProps {
  route: Route;
  onOpenNav: () => void;
}

export function Topbar({ route, onOpenNav }: TopbarProps) {
  return (
    <header className="vd-topbar">
      <IconButton
        label="Abrir menú"
        icon="menu"
        className="vd-topbar__menu"
        onClick={onOpenNav}
      />
      <SearchBox route={route} />
      <div className="vd-topbar__actions">
        <ThemeToggle />
        <ProfileMenu />
      </div>
    </header>
  );
}
