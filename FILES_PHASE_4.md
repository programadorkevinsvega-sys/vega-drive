# Fase 4 — Transferencias privadas con R2

**Estado:** implementación de código lista para validación; cierre operativo pendiente de la configuración real de Cloudflare y de una prueba E2E tras el despliegue. La fase no está marcada como cerrada hasta registrar esas evidencias.

## Alcance implementado

- IFileStoragePort mantiene los casos de uso desacoplados de R2.
- R2FileStorage, dentro de src/modules/files/infrastructure/storage/r2, es el único adaptador que accede a FILES_BUCKET.
- POST /api/files acepta el contenido binario en el cuerpo de la petición; el nombre, carpeta, tamaño declarado y tipo de contenido viajan en cabeceras same-origin. No se acepta una clave de almacenamiento desde el navegador.
- El contenido se transmite como stream, limitado a 95 MiB por archivo. El backend genera claves con u/{userId}/{uuid}, verifica el tamaño real mediante HEAD y solo registra los metadatos tras completar un objeto del tamaño esperado.
- Una reserva D1 impide superar el límite inicial de 1 GiB por propietario. files_transfer_events aplica límites de 20 subidas y 120 descargas por hora por propietario.
- GET /api/files/:id/download comprueba sesión, propiedad y carpeta activa antes de obtener el contenido. Soporta un único rango HTTP de bytes, responde con attachment, nosniff y no-store; no devuelve URLs de R2.
- Un cron horario reconcilia reservas de subida vencidas/fallidas y poda eventos de limitación antiguos. Si la eliminación de un objeto falla, se mantiene el registro para reintentar.
- Se eliminó la ruta antigua POST /api/files/items/metadata, que permitía crear solo metadatos sin bytes. La API ya no crea archivos descargables ficticios.
- Los controles arquitectónicos exigen el puerto y adaptador y prohíben usar el binding de R2 fuera del adaptador autorizado.

## Rutas de transferencia

| Método | Ruta | Comportamiento |
|---|---|---|
| POST | /api/files | Subida binaria autenticada; X-File-Name (URI-encoded), X-File-Size y opcionalmente X-File-Folder-Id; Content-Type declara el tipo del archivo. |
| GET | /api/files/:id/download | Descarga autenticada con streaming; acepta un único encabezado Range. |

Las rutas existentes del catálogo —listado, carpetas, movimientos y papelera— siguen activas en /api/files. El frontend aún no incorpora el control visual para seleccionar/subir archivos; esa integración corresponde a la Fase 5 y no equivale a permitir acceso directo a R2.

## Límites iniciales

- Tamaño máximo por archivo: 95 MiB para permanecer por debajo del límite de cuerpo de Worker.
- Capacidad reservada por propietario: 1 GiB; se cuentan metadatos existentes, incluidos elementos en papelera, además de reservas pendientes/fallidas.
- Frecuencia por propietario: máximo 20 intentos de subida y 120 descargas en una ventana móvil de una hora.
- El MIME se valida como tipo declarativo, no se considera una prueba de la naturaleza real del archivo. Las descargas siempre son attachment con nosniff.

Estos valores son límites iniciales del producto en files; cuotas configurables y políticas adicionales siguen siendo trabajo de las Fases 6 y 8.

## Pruebas añadidas

- HTTP del BFF real con sesiones autenticadas para subida, descarga completa, rango parcial, rango inválido y rechazo de acceso cruzado.
- Rechazo cuando el tamaño real del stream no coincide con el declarado.
- Reservas de capacidad y límite de transferencias por propietario.
- Localización de subidas vencidas/fallidas para la limpieza programada.
- El fake de R2 se usa solamente en pruebas; no se incorpora al Worker de producción.

## Verificación y despliegue

La migración src/modules/files/infrastructure/persistence/d1/migrations/0003_files_transfers.sql agrega files_transfer_events e índices propios del módulo. pnpm run deploy usa el preflight antes de aplicar migraciones remotas, comprueba el esquema D1 y solo entonces publica Worker y verifica /api/health. La nueva migración no debe editarse después de haber sido aplicada en un entorno compartido.

## Evidencia operativa pendiente

- [ ] Verificar en el panel que vega-drive-files permanece privado, no tiene dominio público ni r2.dev, y no acepta CORS de navegador.
- [ ] Confirmar permisos mínimos del binding/credenciales limitados a ese bucket.
- [ ] Desplegar la versión candidata por el procedimiento documentado, no con wrangler deploy --dry-run.
- [ ] Ejecutar en producción una subida/descarga E2E con un archivo de prueba, comprobar rango parcial y probar que una segunda cuenta no puede descargarlo.
- [ ] Adjuntar el SHA desplegado y el resultado verificable a la evidencia de fase, sin copiar credenciales o cookies.

No llamar 100 % cerrada a la Fase 4 hasta resolver la lista de evidencia operativa anterior.
