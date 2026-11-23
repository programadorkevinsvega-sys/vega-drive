# Vega Drive — Frontend integrado

Frontend React/Vite integrado en el único Cloudflare Worker de Vega Drive. Sus dependencias mantienen un `package.json` y `pnpm-lock.yaml` propios, separados del workspace raíz.

**Estado: integrado y funcional. Revisión documental: 2026-11-23.** Mi unidad, Papelera, Recientes, Favoritos, Búsqueda, autenticación, transferencias y vista previa están conectados al BFF. Sharing se integra mediante las rutas del producto de la Fase 7. Quota sigue pendiente en la Fase 6.

## Requisitos

- Node.js `22.23.5` o superior.
- pnpm `11.28.13` (versión fijada en el repositorio).

## Instalar, comprobar y ejecutar

Desde la raíz de Vega Drive:

```bash
pnpm install --frozen-lockfile
pnpm run frontend:install
pnpm run frontend:check
pnpm run cloudflare:build
pnpm run dev
```

Para ejecutar únicamente Vite durante trabajo visual: `pnpm --dir frontend run dev`.

El frontend conserva su instalación aislada; no combines los lockfiles. `cloudflare:build` instala/verifica dependencias, ejecuta las guardias, pruebas, auditorías y Wrangler dry-run. No despliega ni aplica migraciones remotas. `pnpm run deploy` sí es el flujo de producción y requiere autorización operativa.

## Vistas y estado funcional

| Ruta hash             | Contenido                                   |
| --------------------- | ------------------------------------------- |
| `#/drive`             | Mi unidad: catálogo, carpetas y acciones    |
| `#/drive/folder/<id>` | Contenido de carpeta y breadcrumbs          |
| `#/recent`            | Archivos abiertos/descargados recientemente |
| `#/favorites`         | Favoritos del propietario                   |
| `#/search?q=...`      | Búsqueda por nombre, tipo y cursor          |
| `#/trash`             | Papelera y restauración                     |
| `#/settings`          | Cambio de contraseña                        |
| `#/login`             | Login con Turnstile                         |
| `#/register`          | Registro cerrado con Turnstile              |

Las rutas hash desconocidas y los identificadores inválidos muestran página no encontrada. Wrangler mantiene `not_found_handling = "none"`: assets faltantes conservan 404 y la API no recibe un fallback HTML.

## Transferencias y vista previa

- Subida simple y multipart para archivos grandes, con progreso, pausa/reanudación, cancelación y reintentos.
- Descargas autenticadas con verificación de propiedad.
- El Worker conserva el plano de control. Si `DIRECT_R2_TRANSFERS_ENABLED` está activo, el navegador puede intercambiar bytes directamente con R2 mediante URLs prefirmadas temporales de alcance mínimo emitidas por el Worker. No recibe credenciales ni claves internas.
- El valor efectivo actual del feature flag debe consultarse en el entorno Worker; no se puede deducir del repositorio.
- La vista previa utiliza rutas same-origin autenticadas y el Worker transmite los bytes privados. No entrega URLs R2 y no depende de CORS del navegador hacia R2.
- Formatos y límites de vista previa: [FILES_PREVIEW.md](../FILES_PREVIEW.md).

## Seguridad y responsabilidades

- El frontend es una capa de presentación; la autorización y propiedad siempre se validan en el backend.
- Las llamadas de control usan el mismo origen bajo `/api`.
- La cookie de sesión es HttpOnly y el JavaScript no puede leer el token.
- El único almacenamiento persistente local de preferencia de UI es el tema (`light|dark|system`). No guardar contraseñas, tokens ni URLs prefirmadas.
- Las claves R2 y credenciales S3 nunca llegan al navegador.
- La CSP y cabeceras se configuran para assets y respuestas del Worker; X-Frame-Options `SAMEORIGIN` y CSP `frame-ancestors 'self'` permiten la vista previa PDF dentro de Vega Drive y bloquean framing externo.
- No existe entorno staging; no crear ni presuponer uno.

## Estructura

```text
frontend/
  index.html · vite.config.ts · vitest.config.ts · tsconfig.json
  package.json · pnpm-lock.yaml · public/_headers
  src/
    main.tsx            raíz de composición
    App.tsx             proveedores + selección de layout
    brand/              símbolo y logotipo
    styles/             tokens, temas, base y estilos de componentes
    ui/                 componentes base
    shell/              navegación y shell
    router/             rutas hash y navegación
    theme/              preferencia de tema
    domain/             tipos de presentación
    services/           clientes same-origin para BFF
    screens/            vistas de producto
    *.test.ts           pruebas junto al código
```

## Decisiones de diseño

- Identidad visual Vega, paleta azul-pizarra/turquesa y temas claro/oscuro.
- Tipografía del sistema; no cargar fuentes externas.
- Tokens CSS con prefijo `--vd-`; componentes consumen tokens semánticos.
- Foco visible, etiquetas accesibles, navegación por teclado, avisos con roles ARIA y soporte para reduced motion/forced colors.
- Sin estilos inline; la CSP bloquea inline scripts/styles no autorizados.
- Archivos de código sujetos al límite arquitectónico de 200 líneas salvo excepción aprobada.

## Verificación y evidencia

La CI ejecuta las comprobaciones frontend junto con las guardias de arquitectura y backend. El cierre de Fase 5 cubre las vistas y servicios conectados. Las pruebas automatizadas con D1/R2 simulados no demuestran por sí solas la configuración externa ni el estado actual de producción.

Los controles transversales de seguridad están cerrados según Fase 8. La certificación operativa de Fase 9 sigue pendiente de confirmar la recuperación D1 (Time Travel), historial de deployments, logs/alertas disponibles y ejercicios autorizados de rollback/recuperación. Ver [Rollback.md](../Rollback.md) y [roadmap.md](../roadmap.md).

## Pendientes conocidos fuera del cierre de integración

- Quota configurable: Fase 6, reservada para el final.
- Preferencias/perfil adicionales en Ajustes: mejora futura, no parte de las capacidades funcionales ya conectadas.
- Pruebas de tecnología de asistencia y navegadores/dispositivos adicionales deben añadirse cuando se amplíe la matriz de aceptación; no declarar probadas plataformas que no se hayan ejecutado.
