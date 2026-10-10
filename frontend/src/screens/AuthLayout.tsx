import { VegaLogo } from "../brand/VegaLogo";
import { useDocumentTitle } from "../lib/use-document-title";
import { routeMeta } from "../router/route-meta";
import type { Route } from "../router/routes";
import { ThemeToggle } from "../theme/ThemeToggle";
import { Icon } from "../ui/Icon";

export interface AuthLayoutProps {
  route: Route;
}

/**
 * Marco de las pantallas de acceso. En esta entrega solo es un esqueleto:
 * no hay formulario, no se leen credenciales y no se envia nada.
 */
export function AuthLayout({ route }: AuthLayoutProps) {
  const { title } = routeMeta(route);
  const isLogin = route.name === "login";
  useDocumentTitle(title);

  return (
    <div className="vd-auth">
      <div className="vd-auth__tools">
        <ThemeToggle />
      </div>
      <main className="vd-auth__panel">
        <a href="#/drive" className="vd-auth__brand" aria-label="Vega Drive">
          <VegaLogo />
        </a>
        <h1 className="vd-auth__title">{title}</h1>
        <p className="vd-auth__text">
          El formulario se construye en la Entrega 4. Esta pantalla no autentica
          a nadie ni envía datos.
        </p>
        <p className="vd-modal__note">
          <Icon name="info" size="sm" />
          Vista previa de diseño: no hay cuentas reales.
        </p>
        <a href={isLogin ? "#/register" : "#/login"}>
          {isLogin ? "Ir a crear cuenta" : "Ir a iniciar sesión"}
        </a>
      </main>
    </div>
  );
}
