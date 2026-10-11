import { VegaLogo } from "../brand/VegaLogo";
import { NavLink } from "../router/NavLink";
import { Button } from "../ui/Button";
import { Icon } from "../ui/Icon";
import { IconButton } from "../ui/IconButton";
import { PRIMARY_NAV, SETTINGS_NAV, type NavItem } from "./nav-items";

function NavEntry({ item }: { item: NavItem }) {
  return (
    <NavLink to={item.to} className="vd-nav__link">
      <Icon name={item.icon} />
      {item.label}
    </NavLink>
  );
}

export interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ open, onClose }: SidebarProps) {
  return (
    <aside
      className={open ? "vd-sidebar is-open" : "vd-sidebar"}
      aria-label="Barra lateral"
    >
      <div className="vd-sidebar__brand">
        <a
          href="#/drive"
          className="vd-sidebar__home"
          aria-label="Vega Drive, ir a Mi unidad"
        >
          <VegaLogo />
        </a>
        <IconButton
          label="Cerrar menú"
          icon="close"
          size="sm"
          className="vd-sidebar__close"
          onClick={onClose}
        />
      </div>
      <Button
        icon="upload"
        size="lg"
        fullWidth
        disabled
        title="Las transferencias reales con R2 todavía no están disponibles"
      >
        Subir archivos · Próximamente
      </Button>
      <nav className="vd-nav" aria-label="Navegación principal">
        {PRIMARY_NAV.map((item) => (
          <NavEntry key={item.label} item={item} />
        ))}
      </nav>
      <div className="vd-sidebar__foot">
        <NavEntry item={SETTINGS_NAV} />
      </div>
    </aside>
  );
}
