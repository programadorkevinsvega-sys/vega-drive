# Vega Drive

Sistema privado de almacenamiento de archivos en la nube sobre Cloudflare para un máximo de 10 clientes. El aislamiento entre cuentas es obligatorio: un cliente no puede leer, editar ni eliminar archivos de otro.

> Estado: Fase 0 en construcción. Consulta ARCHITECTURE_NODE_CLOUDFLARE_RULES_ALL.md, Security.md y roadmap.md.

## Arquitectura

Vega Drive es un monolito modular serverless: un Worker, una base D1 (VEGA_DRIVE_DB) y un bucket R2 privado. El frontend y el BFF comparten origen. El navegador solo consume /api; nunca contacta R2 ni recibe credenciales, SDK de almacenamiento o URLs prefirmadas.

Cada módulo (identity, files, quota y sharing) es dueño de sus tablas con prefijo, migraciones, repositorios, dominio y API pública. Aunque existe una sola D1, están prohibidos JOIN, claves foráneas, SQL entre módulos, imports de implementaciones internas y transacciones entre módulos. La guardia de arquitectura inspecciona el código fuente para detectar varias de estas violaciones; no sustituye la revisión de código.

El módulo files será el único autorizado para usar R2, mediante IFileStoragePort en su infraestructura. La Fase 0 solo establece la estructura: el adaptador de almacenamiento, la autorización por usuario y el flujo real de archivos todavía no están implementados.

## Flujo de archivos previsto

1. El frontend envía el archivo a POST /api/files.
2. El BFF valida transporte y sesión y llama a FilesGateway.
3. El módulo files valida autorización, cuota, nombre y tamaño.
4. Su adaptador privado transmite a R2.
5. El módulo registra los metadatos y devuelve un resultado seguro.

Las descargas atravesarán GET /api/files/:id/download y el Worker transmitirá el contenido autorizado desde R2. Este flujo es el objetivo arquitectónico, no una función ya implementada.

## Estructura

- src/worker: entrada del Worker y handlers.
- src/bff: Hono y composition root.
- src/modules/identity, files, quota y sharing: límites modulares y APIs públicas.
- src/platform: infraestructura técnica compartida.
- src/shared-kernel: abstracciones universales mínimas.
- public: assets estáticos.
- tests: pruebas y verificaciones de arquitectura.

## Servicios Cloudflare

| Necesidad | Servicio |
|---|---|
| Backend, BFF y assets | Cloudflare Workers |
| Metadatos, usuarios y sesiones | D1: VEGA_DRIVE_DB |
| Archivos | R2 privado, solo módulo files |
| Anti-bots | Turnstile |
| Tareas futuras | Queues y Cron Triggers, solo cuando haya consumidores reales |

El userId deberá derivarse de la sesión validada, nunca de una entrada confiada al cliente. R2 no debe tener acceso público, r2.dev, dominio público ni CORS de navegador. Las claves de objeto se crearán en el backend.

## Desarrollo

Requisitos: Node.js 22+, npm 10+ y cuenta Cloudflare. Ejecuta npm install y npm run dev. Configura secretos solo con Wrangler, por ejemplo npx wrangler secret put TURNSTILE_SECRET_KEY; nunca los guardes en Git.

## Recursos Cloudflare

El ID de D1 en wrangler.toml es un marcador hasta crear el recurso en la cuenta correcta:

    npx wrangler d1 create VEGA_DRIVE_DB
    npx wrangler r2 bucket create vega-drive-files

Copia el ID real de D1 a wrangler.toml. npm run deploy se bloquea mientras el ID siga siendo el marcador. Mantén R2 privado. La comprobación local no puede verificar si el bucket está expuesto públicamente en la cuenta Cloudflare.

## Comandos

| Comando | Propósito |
|---|---|
| npm run dev | Worker local |
| npm run format:check | Formato |
| npm run lint | Guardia arquitectónica |
| npm run typecheck | TypeScript estricto |
| npm test | Pruebas |
| npm run check | Formato, arquitectura, tipos y pruebas |
| npm run deploy | Comprueba el ID D1 y después intenta desplegar |

## CI y protección de rama

Cada PR a main ejecuta formato, guardia arquitectónica, typecheck, pruebas, npm audit y Gitleaks. Gitleaks necesita permiso de lectura de PR para consultar los commits del pull request. Dependabot y la plantilla de PR quedan configurados. La protección de rama requiere activar en GitHub la obligatoriedad de CI; un workflow no protege main por sí solo.

## Estado de Fase 0

No declarar la Fase 0 completa hasta tener un lockfile de npm versionado, CI verde, recursos D1/R2 reales y privados, y protección de la rama main. Los módulos de negocio y el flujo de archivos no forman parte de este andamiaje.
