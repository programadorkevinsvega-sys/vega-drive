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

## Datos y alcance funcional

La autenticación de la interfaz está conectada al backend existente: la sesión se
consulta al cargar la aplicación, las rutas de la interfaz requieren una sesión
resuelta, login y registro envían el token Turnstile, y cerrar sesión llama al
endpoint de revocación. No se cambió la lógica de identidad del backend ni se
añadieron endpoints. El registro no inicia sesión automáticamente: después de
crear la cuenta, el usuario debe iniciar sesión.

Las pantallas de drive, carpetas, recientes, favoritos, papelera, búsqueda y ajustes
siguen siendo marcadores visuales; la autenticación real no significa que las
operaciones de archivos estén implementadas.

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

## Evidencia pendiente antes de cerrar la subfase

- Ejecutar el gate completo sobre el commit integrado y revisar el diff, incluido
  el formateo manual acordado.
- Probar localmente `/`, archivos JS/CSS/favicon, 404 de assets, `/api/health` y un
  endpoint API inexistente; comprobar tipo de contenido, CSP y las demás cabeceras.
- Probar con Turnstile real en el hostname autorizado el login y registro con tokens
  válidos e inválidos; las pruebas unitarias del cliente no sustituyen ese E2E.
- Verificar las cabeceras y la interfaz desplegada en producción después de un
  despliegue autorizado antes de considerar la integración publicada.
- Cumplir `Security.md` y el procedimiento `Rollback.md`; staging y el ensayo de
  rollback siguen pendientes en la documentación operativa.
- No marcar la fase 5 como cerrada ni modificar `roadmap.md` sin la evidencia exigida.

## Reversión

No borrar `frontend/` como procedimiento genérico: ahora forma parte del artefacto
integrado. Antes de revertir, revisar el diff y restaurar de forma coordinada la
configuración de Wrangler, scripts, cabeceras, CI, rutas y la antigua página estática.
Cualquier rollback de un release desplegado debe seguir `Rollback.md`.
