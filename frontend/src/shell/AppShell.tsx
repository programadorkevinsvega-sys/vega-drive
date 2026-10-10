import { useEffect, useRef, useState, type ReactNode } from "react";
import { useDocumentTitle } from "../lib/use-document-title";
import { routeMeta } from "../router/route-meta";
import { buildHash, type Route } from "../router/routes";
import { SimulationBanner } from "./SimulationBanner";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

export interface AppShellProps {
  route: Route;
  children: ReactNode;
}

/**
 * Estructura comun: barra lateral, barra superior y contenido. En pantallas
 * estrechas la barra lateral es un cajon. Al cambiar de ruta el foco pasa al
 * contenido principal (el enlace "Saltar" es un boton porque un ancla #id
 * cambiaria la ruta del enrutador por hash).
 */
export function AppShell({ route, children }: AppShellProps) {
  const [navOpen, setNavOpen] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const isFirstRender = useRef(true);
  const routeKey = buildHash(route);

  useDocumentTitle(routeMeta(route).title);

  useEffect(() => {
    setNavOpen(false);
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    mainRef.current?.focus();
  }, [routeKey]);

  useEffect(() => {
    if (!navOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setNavOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [navOpen]);

  return (
    <div className="vd-shell">
      <button
        type="button"
        className="vd-skip"
        onClick={() => mainRef.current?.focus()}
      >
        Saltar al contenido
      </button>
      <Sidebar open={navOpen} onClose={() => setNavOpen(false)} />
      {navOpen ? (
        <button
          type="button"
          className="vd-shell__scrim"
          aria-label="Cerrar menú de navegación"
          onClick={() => setNavOpen(false)}
        />
      ) : null}
      <div className="vd-shell__main">
        <div className="vd-shell__head">
          <SimulationBanner />
          <Topbar route={route} onOpenNav={() => setNavOpen(true)} />
        </div>
        <main ref={mainRef} tabIndex={-1} className="vd-content">
          {children}
        </main>
      </div>
    </div>
  );
}
