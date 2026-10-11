# Integración del frontend con el Worker existente

## Decisiones aplicadas en el código

- Un solo Worker y un solo origen. La API sigue en Hono bajo `/api/*` y la raíz
  de assets de Wrangler apunta a `./frontend/dist`.
- El enrutado del producto usa hash (`#/drive`, `#/recent`, etc.). Se mantiene
  `not_found_handling = "none"`; ni los assets inexistentes ni las rutas API
  desconocidas deben responder con `index.html`.
- Se mantienen separados `pnpm-lock.yaml` y `frontend/pnpm-lock.yaml`. La raíz
  ofrece `frontend:install`, `frontend:check` y `frontend:audit` para reproducir
  la instalación y validación del paquete independiente.
- Vite copia `frontend/public/_headers` a `frontend/dist`. Workers Static Assets
  aplica desde ese archivo CSP, `nosniff`, Referrer-Policy, X-Frame-Options y
  HSTS a las respuestas estáticas. Hono conserva esas cabeceras en las respuestas
  API y `Cache-Control: no-store` para `/api/*`.
- `cloudflare:build` valida arquitectura, formato, lint, typecheck, tests,
  dependencias de ambos paquetes y `wrangler deploy --dry-run`. El script `deploy`
  ejecuta este gate antes de migraciones o publicación; no se ejecuta como parte
  de estas instrucciones de integración.
- La guía temporal `#/kit` y sus componentes/estilos se retiran.
- Login, registro, consulta de sesión y logout usan `/api/auth/*` en el mismo
  origen. La cookie de sesión permanece HttpOnly y el navegador no lee ni guarda
  el token de sesión.
- El widget oficial de Cloudflare Turnstile se carga en login y registro; el token
  se envía al Worker para validación server-side. La CSP permite los orígenes
  necesarios de Turnstile para script, iframe y conexión.
- Ajustes contiene un formulario real de cambio de contraseña que usa
  `POST /api/auth/password` en el mismo origen. El backend comprueba la sesión
  y la contraseña actual, rota la cookie y revoca las otras sesiones; el
  navegador no lee el valor de la cookie HttpOnly.

## Datos y alcance funcional

La autenticación de la interfaz está conectada al backend existente: la sesión se
consulta al cargar la aplicación, las rutas de la interfaz requieren una sesión
resuelta, login y registro envían el token Turnstile, y cerrar sesión llama al
endpoint de revocación. No se cambió la lógica de identidad del backend ni se
añadieron endpoints. El registro no inicia sesión automáticamente: después de
crear la cuenta, el usuario debe iniciar sesión.

Mi unidad, las carpetas y la papelera ya consumen las rutas autenticadas de `/api/files` mediante `services/files-service.ts`: listado con paginación, breadcrumbs, creación de carpetas, renombrado, movimiento, borrado lógico y restauración. El cliente usa solo el mismo origen, `credentials: same-origin` y `cache: no-store`; la autorización sigue exclusivamente en el Worker. Las pantallas recientes, favoritos y búsqueda siguen siendo marcadores. No se realizan transferencias de bytes ni acceso del navegador a R2. Ajustes conserva el cambio real de contraseña; el perfil y otras preferencias siguen pendientes.

El contrato y las rutas del catálogo están documentados en
[FILES_PHASE_3.md](../FILES_PHASE_3.md), sección 7. La conexión inicial del
cliente y las pantallas Mi unidad/papelera ya está implementada. La Fase 5 sigue
abierta: quedan la integración de presentación restante, la comprobación integral
de assets/cabeceras en el Worker y la aceptación operativa.

## Comandos de instalación y validación

Desde la raíz del repositorio, con Node `>=22.13.0` y pnpm `10.18.3`:

```bash
pnpm install --frozen-lockfile
pnpm run cloudflare:build
```

`cloudflare:build` no despliega ni migra recursos remotos. Produce el build de assets,
corre las comprobaciones y ejecuta el dry-run del build Worker/Assets. Para probar el
servidor local después del build:

```bash
pnpm run dev
```

El gate `cloudflare:build` instala por sí mismo las dependencias del frontend con
su lockfile independiente, por lo que también funciona en proveedores de build que
solo instalan las dependencias de la raíz. La CI ejecuta ese mismo gate y mantiene
Gitleaks como job independiente. Ninguna de estas comprobaciones
por sí sola demuestra la aplicación de cabeceras o disponibilidad en producción.

## Evidencia de integración y pendientes de la fase 5

- [x] Ejecutar el gate completo sobre el commit integrado y revisar el diff, incluido el formateo manual acordado. La ejecución de GitHub Actions del commit `bd7e192f1afe6e89af2b6c10442f2b51e7d60ed5` terminó correctamente: [ver CI](https://github.com/programadorkevinsvega-sys/vega-drive/actions/runs/38112184984).
- [ ] Probar localmente `/`, archivos JS/CSS/favicon, 404 de assets, `/api/health` y un endpoint API inexistente; comprobar tipo de contenido, CSP y las demás cabeceras.
- [x] Conectar Mi unidad, carpetas y papelera con `files-service.ts` y el BFF same-origin; comprobar estado vacío, carga, error, paginación y acciones contra el catálogo.
- [x] El propietario confirmó la prueba de extremo a extremo en producción: Turnstile válido funciona y el servidor rechaza un token inválido en el flujo probado.
- [x] Tras publicar Ajustes, el propietario probó el cambio de contraseña: la nueva contraseña permite iniciar sesión, la anterior es rechazada, la sesión actual sigue operativa y las sesiones previas quedan revocadas.
- [ ] Verificar en producción las cabeceras CSP, HSTS, nosniff, framing, Referrer-Policy y `Cache-Control`. La interfaz de Ajustes y el flujo de cambio de contraseña ya fueron aceptados funcionalmente.
- [ ] Cumplir el checklist aplicable de `Security.md` y el procedimiento `Rollback.md`; staging aislado y el ensayo de rollback siguen pendientes.
- [ ] No marcar la fase 5 como cerrada hasta que se reúna la evidencia de presentación, assets, cabeceras y operación requerida en su propio alcance. El cierre de la Fase 2 ni la conexión inicial del catálogo cierran automáticamente la fase 5.

## Reversión

No borrar `frontend/` como procedimiento genérico: ahora forma parte del artefacto
integrado. Antes de revertir, revisar el diff y restaurar de forma coordinada la
configuración de Wrangler, scripts, cabeceras, CI, rutas y la antigua página estática.
Cualquier rollback de un release desplegado debe seguir `Rollback.md`.
