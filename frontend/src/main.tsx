import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/index.css";
import { App } from "./App";
import { createMockServices } from "./mock/mock-services";
import { ensureDefaultHash } from "./router/use-route";
import { applyInitialTheme } from "./theme/theme-dom";

applyInitialTheme();
ensureDefaultHash();

const container = document.getElementById("root");
if (!container) throw new Error("No se encontro el contenedor #root.");

createRoot(container).render(
  <StrictMode>
    <App services={createMockServices()} />
  </StrictMode>,
);
