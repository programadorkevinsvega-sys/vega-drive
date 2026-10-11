import { navigate } from "../router/use-route";
import { useAuth } from "../services/auth-context";
import { MenuButton, type MenuItem } from "../ui/MenuButton";
import { useToast } from "../ui/toast-context";

/** Menú de cuenta real: el cierre revoca la sesión a través del Worker. */
export function ProfileMenu() {
  const { user, signOut } = useAuth();
  const { notifySimulated } = useToast();
  const email = user?.email ?? "";
  const initial = email.trim().slice(0, 1).toUpperCase() || "?";
  const items: MenuItem[] = [
    { id: "settings", label: "Ajustes", icon: "settings", onSelect: () => navigate({ name: "settings" }) },
    {
      id: "logout",
      label: "Cerrar sesión",
      icon: "logout",
      onSelect: () => {
        void signOut().then(() => navigate({ name: "login" })).catch(() => {
          notifySimulated({ tone: "error", title: "No se pudo cerrar la sesión", description: "Comprueba tu conexión e inténtalo de nuevo." });
        });
      },
    },
  ];
  return <MenuButton label={email ? "Menú de cuenta de " + email : "Menú de cuenta"} items={items} triggerClassName="vd-avatar">
    <span aria-hidden="true">{initial}</span>
  </MenuButton>;
}
