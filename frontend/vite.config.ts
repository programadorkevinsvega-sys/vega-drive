import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Misma politica que el Worker aplica hoy a /api. Solo se usa en `vite preview`
// (build de produccion); el servidor de desarrollo necesita scripts en linea.
const PRODUCTION_CSP =
  "default-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'";

export default defineConfig({
  base: "./",
  plugins: [react()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: false,
    target: "es2022",
  },
  server: { host: "127.0.0.1", port: 5173 },
  preview: {
    host: "127.0.0.1",
    port: 4173,
    headers: {
      "Content-Security-Policy": PRODUCTION_CSP,
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
    },
  },
});
