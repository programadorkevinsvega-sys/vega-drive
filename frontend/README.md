# Vega Drive · frontend integrado

Base visual y esqueleto de navegación de Vega Drive, servidos por el Worker existente.
Las dependencias del frontend se mantienen aisladas con su propio `package.json` y
`pnpm-lock.yaml`; no se fusionan con el workspace ni con el lockfile raíz.

## Estado

| Incluido hoy                                                   | Pendiente                                                      |
| ------------------------------------------------------------- | -------------------------------------------------------------- |
| Identidad visual, tokens CSS y temas claro/oscuro              | Explorador real de archivos, carpetas, recientes, favoritos y papelera |
| Componentes base accesibles y navegación por hash              | Operaciones reales de archivos y transferencias privadas con R2 |
| Login, registro y sesiones conectados al Worker                | Búsqueda funcional sobre los datos de archivos                 |
| Turnstile en login y registro                                  | Perfil y preferencias adicionales en Ajustes                  |
| Formulario de cambio de contraseña en `#/settings`            | Pruebas de aceptación y publicación autorizada de este cambio  |

Las pantallas de archivos y búsqueda siguen siendo **marcadores** con datos
simulados. Login, registro, sesiones y cambio de contraseña usan las rutas reales
de identidad del Worker; el frontend todavía no implementa las operaciones de
archivos.

## Requisitos

- Node 22 (`>=22.13.0`, probado con 22.22.2) y pnpm 10.18.3, igual que el repo.

## Instalar, comprobar y ejecutar dentro del repositorio

Desde la raíz de Vega Drive:

```bash
pnpm install --frozen-lockfile
pnpm run frontend:install
pnpm run frontend:check       # typecheck + pruebas + build del frontend
pnpm run cloudflare:build     # guardias, checks, auditorías y build dry-run de Wrangler
pnpm run dev                  # Worker local; requiere el build de assets anterior
```

Para ejecutar únicamente Vite durante trabajo visual: `pnpm --dir frontend run dev`.
El frontend conserva una instalación aislada; no borres ni combines ninguno de los
lockfiles. Las rutas por hash son estado del navegador y no requieren un fallback HTTP.

Qué revisar primero:

1. `#/settings`: formulario real para cambiar la contraseña de la cuenta.
2. `#/login` y `#/register`: formularios conectados al Worker con Turnstile.
3. Cambiar el tema con el selector de la barra superior.
4. Reducir la ventana a menos de 900 px: la barra lateral pasa a cajón.

## Rutas

| Hash                  | Contenido hoy                       | Se construye en |
| --------------------- | ----------------------------------- | --------------- |
| `#/drive`             | Marcador de Mi unidad               | Entrega 3       |
| `#/drive/folder/<id>` | Marcador de carpeta (`id` validado) | Entrega 3       |
| `#/recent`            | Marcador                            | Entrega 3       |
| `#/favorites`         | Marcador                            | Entrega 3       |
| `#/trash`             | Marcador                            | Entrega 3       |
| `#/search?q=...`      | Marcador (el buscador ya navega)    | Entrega 5       |
| `#/settings`          | Cambio de contraseña                | Fase 2          |
| `#/login`             | Formulario real + Turnstile         | Fase 2          |
| `#/register`          | Formulario real + Turnstile         | Fase 2          |

Una ruta hash desconocida o un identificador de carpeta no válido muestran
"Página no encontrada". Las rutas por hash no llegan al servidor HTTP. Wrangler usa
`not_found_handling = "none"`: los assets que faltan conservan 404 y la API no recibe
un fallback HTML.

## Estructura

```text
frontend/
  index.html · vite.config.ts · vitest.config.ts · tsconfig.json
  package.json · pnpm-lock.yaml · public/favicon.svg
  src/
    main.tsx            raíz de composición (único lugar que importa mock/)
    App.tsx             proveedores + selección de layout
    brand/              símbolo y logotipo
    styles/             tokens, tema oscuro, base y un CSS por componente
    ui/                 componentes base (botón, campo, modal, menú, avisos...)
    shell/              barra lateral, barra superior, buscador, perfil
    router/             rutas, parseo/construcción de hash, NavLink
    theme/              preferencia de tema (pura) + proveedor + selector
    domain/             tipos de presentación (UserProfile)
    services/           contratos (ProfileService) + contexto de inyección
    mock/               adaptadores SIMULADOS
    screens/            marcadores y layout visual de acceso
    *.test.ts           pruebas junto al código
```

## Decisiones de diseño

- **Identidad**: una "V" de dos trazos con una estrella de cuatro puntas en su
  apertura (Vega, la estrella de Lyra). Logotipo tipográfico "Vega" en negrita
  y "Drive" en peso normal.
- **Paleta**: tinta azul-pizarra (`#17203a`), papel frío y un acento
  turquesa profundo (`#0a7c86`), lejos del azul de los servicios conocidos. El
  color ámbar queda reservado a todo lo **simulado**.
- **Tipografía**: pila del sistema; la CSP bloquea fuentes externas.
- **Tokens**: `src/styles/tokens.css` (claro) y `dark.css` (oscuro) con prefijo
  `--vd-`. Los componentes solo usan tokens semánticos.
- **Accesibilidad**: foco visible, objetivos ≥ 32 px, diálogo sobre `<dialog>`
  nativo, menú con patrón ARIA y teclado, avisos con `role` status/alert,
  `prefers-reduced-motion` y `forced-colors`. El tono de un aviso no depende
  solo del color.
- **Sin estilos en línea**: la CSP del Worker (`default-src 'self'`) los
  bloquearía; todo va por clases y variables CSS.
- **Archivos ≤ 200 líneas** (regla de la arquitectura), verificado por prueba.

## Seguridad y límites

- Las solicitudes de identidad usan solo `fetch` al mismo origen bajo
  `/api/auth/*`; no se incorporan XHR, sockets ni referencias a R2/S3.
  Las guardias del repo comprueban que la capa de UI no asuma autorización.
- Único almacenamiento persistente del frontend: la preferencia de tema
  (`light|dark|system`) en `localStorage`, a través de `lib/safe-storage.ts`.
  Las contraseñas no se guardan en almacenamiento local y el token de sesión
  permanece en una cookie HttpOnly controlada por el navegador.
- Los identificadores de ruta se validan solo como ayuda de UX. La
  autorización es del backend.
- Toda acción simulada se rotula como tal en la interfaz ("Simulado").

## Historial de verificación de la entrega visual (previo a la integración)

| Comprobación                                                            | Resultado                                      |
| ----------------------------------------------------------------------- | ---------------------------------------------- |
| `pnpm run typecheck` (TS 5.9.3, estricto)                               | Sin errores                                    |
| `pnpm run test` (Vitest 5.0.2)                                          | 103 pruebas en 7 archivos, todas correctas     |
| `pnpm run build`                                                        | JS 252 kB (78 kB gzip), CSS 22 kB (5 kB gzip)  |
| 9 guardias `scripts/architecture/verify-*.mjs` del repo, en una copia   | Todas OK, incluida "Frontera del frontend"     |
| Chromium headless 153 sobre `vite preview` con la CSP del Worker        | 29/29 comprobaciones; 0 errores de consola/CSP |
| Revisión visual (claro, oscuro, móvil 390 px) y desbordamiento a 360 px | Sin desbordamiento en las 5 rutas medidas      |

Las pruebas incluyen contraste WCAG (33 pares en cada tema) y se comprobó que
**fallan** al introducir a propósito un error de contraste, un `fetch` o
referencias a R2/XHR. Un fallo real hallado y corregido durante la revisión:
el buscador desbordaba la barra superior a 360 px.

## Pendiente de verificar

- Lectores de pantalla reales (NVDA, VoiceOver, TalkBack): los avisos y el
  menú siguen el patrón ARIA pero no se probaron con tecnología de asistencia.
- Firefox y Safari (solo se probó Chromium).
- Tablet y orientación horizontal en dispositivos reales.
- Pruebas de componentes con DOM (jsdom/Testing Library): no se añadieron para
  no sumar dependencias; la lógica pura sí está cubierta.
- El check aislado del frontend descrito arriba no demuestra que el Worker lo
  sirva ni que la política `_headers` se aplique en Cloudflare. Para esos puntos se
  necesita el build integrado y smoke tests en un entorno desplegado.
- La CI y la auditoría de dependencias del frontend se incorporan al flujo principal
  mediante `pnpm run cloudflare:build`; deben volver a verificarse tras estos cambios.

## Problemas conocidos

- En `#/drive` el título repite la ruta ("Mi unidad" dos veces); se resolverá
  con el dashboard real.
- Sin apple-touch-icon (requiere PNG; se puede generar en la integración).
- `vitest` está en 5.0.2 y el repo usa 5.0.3 (versión con < 14 días).
