# Integración futura (requiere aprobación)

Esta entrega **no cambia nada** fuera de `frontend/`. Aquí se listan los
cambios externos que harían falta más adelante. Ninguno está aplicado.

## Cambios externos propuestos

| #  | Dónde                              | Cambio                                                                 | Riesgo / nota                                                                 |
| -- | ---------------------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| 1  | `pnpm-workspace.yaml`              | Añadir `packages: ["frontend"]` **o** mantener instalación independiente | Hoy un `pnpm install` en `frontend/` instala el proyecto raíz (verificado)    |
| 2  | `pnpm-lock.yaml` (raíz)            | Se actualiza al elegir workspace; borrar `frontend/pnpm-lock.yaml`      | Revisar el diff del lockfile; SEC-DEP-01                                      |
| 3  | `package.json` (raíz)              | Scripts `frontend:check` y `frontend:build` (p. ej. `pnpm --dir frontend ...`) | Sin tocar `check` existente hasta decidir                                     |
| 4  | `wrangler.toml` `[assets]`         | Apuntar `directory` a `./frontend/dist` **o** copiar `dist/` a `public/` en el build | Reemplaza el `public/index.html` provisional; cambio de despliegue            |
| 5  | Despliegue (`deploy`, `cloudflare:build`) | Ejecutar el build del frontend antes de `wrangler deploy`        | Hoy ningún script compila un frontend                                         |
| 6  | Cabeceras de los assets            | Aplicar la misma CSP/nosniff/Referrer-Policy a los assets             | Hoy el middleware Hono solo cubre `/api/*`; el HTML lo sirve `ASSETS` sin ellas |
| 7  | CI (`.github/workflows`)           | Añadir typecheck, pruebas y build del frontend                         | `pnpm audit` cubrirá las dependencias nuevas                                  |
| 8  | Formato                            | Ejecutar `pnpm run format` tras copiar                                 | `format:check` fallará hasta entonces                                         |
| 9  | Retirar guía visual                | Borrar `src/screens/kit/`, `styles/kit.css`, su `@import`, la ruta `kit` y su caso en `screen-for-route.tsx` y `route-meta.ts` | Pantalla temporal                                                             |
| 10 | Rutas limpias (opcional)           | `not_found_handling = "single-page-application"` y pasar de hash a History API | Decisión posterior; mientras tanto el hash funciona sin cambios de config     |

Sobre el punto 6: la CSP vigente del Worker es
`default-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'`
(`src/bff/app.ts`). El frontend ya funciona bajo ella (`pnpm run preview`
la aplica). Cómo servirla a los assets (Worker o archivo `_headers`) es una
decisión del propietario y debe verificarse.

## Dependencias nuevas y justificación (SEC-DEP-01)

Versiones **exactas**, todas publicadas hace más de 14 días.

| Paquete                | Versión | Tipo | Motivo                                                  |
| ---------------------- | ------- | ---- | ------------------------------------------------------- |
| `react`, `react-dom`   | 19.3.0  | prod | Biblioteca de interfaz acordada (opción A)              |
| `vite`                 | 8.3.1   | dev  | Empaquetado y servidor de desarrollo                    |
| `@vitejs/plugin-react` | 6.1.1   | dev  | Transformación JSX                                      |
| `@types/react`, `@types/react-dom` | 19.3.0 | dev | Tipos                                          |
| `@types/node`          | 26.6.3  | dev  | Tipos para las pruebas (lectura de archivos)            |
| `typescript`           | 5.9.3   | dev  | Misma versión que el repo                               |
| `vitest`               | 5.0.2   | dev  | Mismo ejecutor que el repo (el repo usa 5.0.3)          |

No se usan librerías de componentes, iconos, estado ni enrutado.

## Cómo sustituir los datos simulados

1. Crear un adaptador que implemente `ProfileService` (`src/services/`) con
   `fetch("/api/...")` **solo cuando el endpoint exista**.
2. Elegir el adaptador en `src/main.tsx` (único punto de composición) y ampliar
   `DataMode` (`src/services/services.ts`) para que el aviso de simulación
   desaparezca solo con datos reales.
3. Las pantallas no cambian: consumen contratos, no `mock/`.

La autorización, la propiedad y las cuotas seguirán siendo del servidor; el
cliente no envía ni acepta `ownerId`, roles ni permisos.

## Supuestos

- La Fase 2 no está iniciada: no hay endpoints de identidad ni de archivos.
- Esta entrega adelanta la presentación de la Fase 5.1; **no** se marca ninguna
  fase del roadmap como completada.
- Los estilos, textos y rutas pueden ajustarse en las entregas 3-6 sin romper
  la arquitectura.

## Pasos de integración (cuando se apruebe)

1. Verificar que el árbol de trabajo está en `main` y limpio.
2. Copiar `frontend/` al repositorio (sin `node_modules`, `dist` ni lockfile).
3. Decidir los puntos 1-5 y 8 de la tabla; aplicarlos en commits pequeños.
4. `pnpm install` (según la decisión 1) y `pnpm run format`.
5. Ejecutar `pnpm run check` del repo, las guardias de arquitectura y el check
   del frontend.
6. Probar en staging según `Rollback.md` antes de producción.

## Reversión

Borrar `frontend/`. No hay ningún otro archivo modificado.
