import type { ReactNode } from "react";
import { buildHash, type Route } from "./routes";
import { useRoute } from "./use-route";

export interface NavLinkProps {
  to: Route;
  className?: string | undefined;
  children: ReactNode;
}

/** Enlace a una ruta; marca aria-current cuando coincide el nombre de ruta. */
export function NavLink({ to, className, children }: NavLinkProps) {
  const current = useRoute();
  return (
    <a
      href={buildHash(to)}
      className={className}
      aria-current={current.name === to.name ? "page" : undefined}
    >
      {children}
    </a>
  );
}
