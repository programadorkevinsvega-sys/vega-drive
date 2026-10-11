# Vega Drive · frontend integrado

Base visual y esqueleto de navegación de Vega Drive, servidos por el Worker existente.
Las dependencias del frontend se mantienen aisladas con su propio `package.json` y
`pnpm-lock.yaml`; no se fusionan con el workspace ni con el lockfile raíz.

## Estado

| Incluido en la Entrega 2                                    | Fuera de alcance (entregas posteriores)        |
| ----------------------------------------------------------- | ---------------------------------------------- |
| Identidad visual (símbolo, logotipo, favicon)               | Dashboard, carpetas, búsqueda y ajustes reales |
| Tokens CSS, tema claro y oscuro                             | Formularios de login y registro                |
| Componentes base: botón, campo, menú, diálogo, avisos, etc. | Cualquier llamada de red                       |
| Esqueleto de navegación con enrutado por hash               | Autenticación, sesiones, autorización, Fase 2  |
| Navegación por hash y tema claro/oscuro                     | Servicios HTTP reales                          |

Las pantallas del producto existen en la navegación como **marcadores
honestos** ("Pantalla en preparación · Entrega N"). Todo dato visible es
simulado y la interfaz lo declara con un aviso permanente.

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

1. `#/drive`: la estructura general (barra lateral, buscador y perfil simulado).
2. Cambiar el tema con el selector de la barra superior.
3. Reducir la ventana a menos de 900 px: la barra lateral pasa a cajón.
4. `#/login` y `#/register`: marcos visuales, todavía sin formularios funcionales.

## Rutas

| Hash                  | Contenido hoy                       | Se construye en |
| --------------------- | ----------------------------------- | --------------- |
| `#/drive`             | Marcador de Mi unidad               | Entrega 3       |
| `#/drive/folder/<id>` | Marcador de carpeta (`id` validado) | Entrega 3       |
| `#/recent`            | Marcador                            | Entrega 3       |
| `#/favorites`         | Marcador                            | Entrega 3       |
| `#/trash`             | Marcador                            | Entrega 3       |
| `#/search?q=...`      | Marcador (el buscador ya navega)    | Entrega 5       |
| `#/settings`          | Marcador                            | Entrega 5       |
| `#/login`             | Marco de acceso (sin formulario)    | Entrega 4       |
| `#/register`          | Marco de acceso (sin formulario)    | Entrega 4       |

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

- Sin `fetch`, XHR, sockets, cookies, `sessionStorage` ni `innerHTML`; sin
  CDNs ni fuentes externas; sin referencias a R2/S3. Lo comprueban
  `src/policy.test.ts` y las guardias del repo (ver abajo).
- Único almacenamiento: la preferencia de tema (`light|dark|system`) en
  `localStorage`, a través de `lib/safe-storage.ts`. Nunca credenciales,
  tokens ni datos de usuario.
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
