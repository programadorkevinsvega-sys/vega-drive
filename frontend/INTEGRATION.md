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
- La guía temporal `#/kit` y sus componentes/estilos se retiran. No se modifican
  los contratos de servicio ni los adaptadores simulados.

## Datos y alcance funcional

Los datos visibles siguen siendo explícitamente simulados. No se añaden llamadas
HTTP desde el frontend, endpoints nuevos, sesiones falsas ni formularios de
autenticación funcionales. La lógica de identidad que ya existe en el backend no
se cambia en esta integración. Las pantallas de drive, carpetas, recientes,
favoritos, papelera, búsqueda, ajustes y acceso continúan siendo marcadores visuales
hasta que sus fases del roadmap implementen sus contratos reales.

## Comandos de instalación y validación

Desde la raíz del repositorio, con Node `>=22.13.0` y pnpm `10.18.3`:

```bash
pnpm install --frozen-lockfile
pnpm run frontend:install
pnpm run cloudflare:build
```

`cloudflare:build` no despliega ni migra recursos remotos. Produce el build de assets,
corre las comprobaciones y ejecuta el dry-run del build Worker/Assets. Para probar el
servidor local después del build:

```bash
pnpm run dev
```

La CI ejecuta el mismo gate de build después de instalar ambas dependencias por
separado y mantiene Gitleaks como job independiente. Ninguna de estas comprobaciones
por sí sola demuestra la aplicación de cabeceras o disponibilidad en producción.

## Evidencia pendiente antes de cerrar la subfase

- Ejecutar el gate completo sobre el commit integrado y revisar el diff.
- Probar localmente `/`, archivos JS/CSS/favicon, 404 de assets, `/api/health` y un
  endpoint API inexistente; comprobar tipo de contenido, CSP y las demás cabeceras.
- Verificar las cabeceras y la interfaz desplegada en un entorno aprobado antes de
  considerar la integración publicada.
- Cumplir `Security.md` y el procedimiento `Rollback.md`; staging y el ensayo de
  rollback siguen pendientes en la documentación operativa.
- No marcar la fase 5 como cerrada ni modificar `roadmap.md` sin la evidencia exigida.

## Reversión

No borrar `frontend/` como procedimiento genérico: ahora forma parte del artefacto
integrado. Antes de revertir, revisar el diff y restaurar de forma coordinada la
configuración de Wrangler, scripts, cabeceras, CI, rutas y la antigua página estática.
Cualquier rollback de un release desplegado debe seguir `Rollback.md`.
