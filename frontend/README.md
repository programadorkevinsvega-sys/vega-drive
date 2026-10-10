# Vega Drive · frontend (Entrega 2)

Base visual y esqueleto de navegación del frontend de Vega Drive.
**Paquete aislado**: no modifica nada del repositorio oficial y se puede
descartar borrando la carpeta `frontend/`.

## Estado

| Incluido en la Entrega 2                                          | Fuera de alcance (entregas posteriores)         |
| ----------------------------------------------------------------- | ----------------------------------------------- |
| Identidad visual (símbolo, logotipo, favicon)                     | Dashboard, carpetas, búsqueda y ajustes reales  |
| Tokens CSS, tema claro y oscuro                                   | Formularios de login y registro                 |
| Componentes base: botón, campo, menú, diálogo, avisos, etc.       | Cualquier llamada de red                        |
| Esqueleto de navegación con enrutado por hash                     | Autenticación, sesiones, autorización, Fase 2   |
| Guía visual temporal en `#/kit`                                   | Servicios HTTP reales                           |

Las pantallas del producto existen en la navegación como **marcadores
honestos** ("Pantalla en preparación · Entrega N"). Todo dato visible es
simulado y la interfaz lo declara con un aviso permanente.

## Requisitos

- Node 22 (`>=22.13.0`, probado con 22.22.2) y pnpm 10.18.3, igual que el repo.

## Probarlo de forma aislada

Descomprime **fuera** del repositorio y, dentro de `frontend/`:

```bash
pnpm install --frozen-lockfile
pnpm run dev       # http://127.0.0.1:5173/#/drive
pnpm run check     # typecheck + pruebas + build
pnpm run preview   # build de producción bajo la CSP del Worker (puerto 4173)
```

> Si lo copias **dentro** del repo, usa `pnpm install --ignore-workspace`: sin
> esa bandera pnpm instala el proyecto raíz y no el frontend.

Qué revisar primero:

1. `#/kit`: guía de color, tipografía, botones, campos, menú, diálogos,
   avisos, estados e iconos (cambia el tema con el icono de la barra superior).
2. `#/drive`: la estructura general (barra lateral, buscador, perfil simulado).
3. Reducir la ventana a < 900 px: la barra lateral pasa a cajón.
4. `#/login` y `#/register`: marco de las pantallas de acceso (sin formulario).

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
| `#/kit`               | Guía visual **temporal**            | se retira       |

Una ruta desconocida o un identificador de carpeta no válido muestran
"Página no encontrada". El enrutado por hash evita tocar la configuración de
Cloudflare (no hay fallback de SPA en `wrangler.toml`).

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
    screens/            marcadores, layout de acceso, guía visual (kit/)
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

## Verificación realizada (comandos reales)

| Comprobación                                                         | Resultado                                       |
| -------------------------------------------------------------------- | ----------------------------------------------- |
| `pnpm run typecheck` (TS 5.9.3, estricto)                            | Sin errores                                     |
| `pnpm run test` (Vitest 5.0.2)                                       | 103 pruebas en 7 archivos, todas correctas      |
| `pnpm run build`                                                     | JS 252 kB (78 kB gzip), CSS 22 kB (5 kB gzip)   |
| 9 guardias `scripts/architecture/verify-*.mjs` del repo, en una copia | Todas OK, incluida "Frontera del frontend"      |
| Chromium headless 153 sobre `vite preview` con la CSP del Worker     | 29/29 comprobaciones; 0 errores de consola/CSP  |
| Revisión visual (claro, oscuro, móvil 390 px) y desbordamiento a 360 px | Sin desbordamiento en las 5 rutas medidas       |

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
- `prettier --check`: **no se ejecutó** (lo pediste así). El código está
  escrito con su estilo, pero habrá que correr `pnpm run format` en el repo.
- `pnpm audit` y CI del repo: no ejecutados (sin auditorías remotas).
- Tras `pnpm run format`, volver a ejecutar `pnpm run test`: Prettier puede
  alargar archivos y la prueba de 200 líneas lo comprobará.

## Problemas conocidos

- `#/kit` es temporal y debe retirarse al integrar.
- En `#/drive` el título repite la ruta ("Mi unidad" dos veces); se resolverá
  con el dashboard real.
- Sin apple-touch-icon (requiere PNG; se puede generar en la integración).
- `vitest` está en 5.0.2 y el repo usa 5.0.3 (versión con < 14 días).
