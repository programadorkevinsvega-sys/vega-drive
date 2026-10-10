import { initialsOf } from "../domain/user";
import { navigate } from "../router/use-route";
import { useProfile } from "../services/use-profile";
import { MenuButton, type MenuItem } from "../ui/MenuButton";
import { Spinner } from "../ui/Spinner";
import { useToast } from "../ui/toast-context";

/** Menu del perfil simulado. "Cerrar sesion" es solo una demostracion. */
export function ProfileMenu() {
  const profile = useProfile();
  const { notifySimulated } = useToast();

  const items: MenuItem[] = [
    {
      id: "settings",
      label: "Ajustes",
      icon: "settings",
      onSelect: () => navigate({ name: "settings" }),
    },
    {
      id: "logout",
      label: "Cerrar sesión (demostración)",
      icon: "logout",
      onSelect: () => {
        notifySimulated({
          tone: "info",
          title: "Cierre de sesión simulado",
          description: "No había ninguna sesión real que cerrar.",
        });
        navigate({ name: "login" });
      },
    },
  ];

  const name = profile.status === "ready" ? profile.data.displayName : null;
  const initials = name ? initialsOf(name) : "?";

  return (
    <MenuButton
      label={name ? `Menú de perfil de ${name}` : "Menú de perfil"}
      items={items}
      triggerClassName="vd-avatar"
    >
      {profile.status === "loading" ? (
        <Spinner size="sm" />
      ) : (
        <span aria-hidden="true">{initials}</span>
      )}
    </MenuButton>
  );
}
