# Fase 4 — Transferencias privadas con R2

**Estado:** flujo original same-origin disponible como rollback; la migración a transferencias directas está implementada detrás de `DIRECT_R2_TRANSFERS_ENABLED=false`. CI pasó en el commit `51b413bfc544ef79ede9fff11ad5793759fa88c1` ([ejecución](https://github.com/programadorkevinsvega-sys/vega-drive/actions/runs/38205025237)). Siguen pendientes CORS/secretos y E2E real; no habilitar el flag hasta verificar aislamiento, multipart y concurrencia.

## Alcance implementado

- IFileStoragePort mantiene los casos de uso desacoplados de R2.
- R2FileStorage, dentro de src/modules/files/infrastructure/storage/r2, es el único adaptador que accede a FILES_BUCKET.
- POST /api/files acepta el contenido binario en el cuerpo de la petición; el nombre, carpeta, tamaño declarado y tipo de contenido viajan en cabeceras same-origin. No se acepta una clave de almacenamiento desde el navegador.
- Las subidas directas se transmiten como stream para archivos de hasta 95 MiB. Los archivos mayores usan multipart con fragmentos de 16 MiB, sesión persistida en D1 y verificación mediante HEAD antes de registrar metadatos. El backend genera claves con u/{userId}/{uuid}.
- Una reserva D1 impide superar la cuota inicial de 10 GiB por propietario. files_transfer_events aplica límites de 20 subidas y 120 descargas por hora por propietario.
- GET /api/files/:id/download comprueba sesión, propiedad y carpeta activa antes de obtener el contenido. Soporta un único rango HTTP de bytes, responde con attachment, nosniff y no-store; no devuelve URLs de R2.
- Un cron horario reconcilia reservas de subida vencidas/fallidas, poda eventos de limitación antiguos y purga elementos de la papelera con más de 30 días.
- Los elementos de la papelera siguen ocupando cuota; al eliminarlos permanentemente se borra el objeto R2 y luego su registro D1.
- La eliminación permanente de una carpeta recorre sus subcarpetas y elimina también los objetos de archivo que contiene.
- Si falla la eliminación física, se conserva el registro restante para que la operación pueda reintentarse en otra ejecución.
- Se eliminó la ruta antigua POST /api/files/items/metadata, que permitía crear solo metadatos sin bytes. La API ya no crea archivos descargables ficticios.
- Los controles arquitectónicos exigen el puerto y adaptador y prohíben usar el binding de R2 fuera del adaptador autorizado.

## Rutas de transferencia

| Método | Ruta                                         | Comportamiento                                                        |
| ------ | -------------------------------------------- | --------------------------------------------------------------------- |
| POST   | `/api/files`                                 | Subida binaria autenticada para archivos de hasta 95 MiB.             |
| POST   | `/api/files/multipart`                       | Inicia una sesión autenticada para un archivo grande.                 |
| PUT    | `/api/files/multipart/:id/parts/:partNumber` | Sube un fragmento de hasta 16 MiB a una sesión propia.                |
| POST   | `/api/files/multipart/:id/complete`          | Completa y verifica el objeto R2 y registra los metadatos.            |
| POST   | `/api/files/multipart/:id/abort`             | Cancela una sesión multipart propia.                                  |
| GET    | `/api/files/:id/download`                    | Descarga autenticada con streaming; acepta un único encabezado Range. |

Las rutas existentes del catálogo —listado, carpetas, movimientos y papelera— siguen activas en /api/files. La interfaz incorpora selección múltiple de archivos y subida de carpetas completas conservando su jerarquía, descarga mediante la ruta same-origin autenticada y una cola visual por archivo con estado, progreso real cuando el navegador lo informa, tamaño, errores, pausa/reanudación, cancelación individual, retirada de pendientes y cancelación de la selección de carpeta. En multipart, la pausa interrumpe el fragmento activo y reintenta ese mismo número al reanudar; los fragmentos ya aceptados se conservan. Los fallos transitorios de fragmentos se reintentan hasta tres veces y los errores de almacenamiento quedan registrados en los logs del Worker sin incluir contenido del archivo. El progreso se obtiene con eventos de XMLHttpRequest; el 100 % solo se muestra cuando el servidor confirma la subida. El flujo original no contacta R2; el nuevo flujo directo, habilitado solo con `DIRECT_R2_TRANSFERS_ENABLED=true`, recibe URLs firmadas de corta duración para PUT/partes y usa una redirección GET firmada. Nunca recibe credenciales ni claves como campos independientes; la URL firmada fija el objeto y, para multipart, la parte autorizada. La integración no sustituye las verificaciones operativas de privacidad, permisos, despliegue y E2E de esta fase.

## Papelera y retención

La papelera conserva archivos y carpetas durante 30 días desde `deleted_at`. El cron ya configurado se ejecuta cada hora y purga los elementos vencidos. La interfaz advierte que los elementos de la papelera siguen consumiendo espacio de almacenamiento. La eliminación permanente está disponible para archivos y carpetas; en carpetas se elimina también el contenido descendiente.

## Límites iniciales

- Tamaño máximo de subida directa: 95 MiB para permanecer por debajo del límite de cuerpo del proxy. Los archivos mayores se dividen en partes de 16 MiB; el máximo de objeto está limitado por R2 y por el límite de partes.
- Capacidad inicial reservada por propietario: 10 GiB. Esta es una cuota de producto inicial, no un límite de R2; el módulo de cuotas de la Fase 6 deberá reemplazarla por una política configurable.
- Frecuencia por propietario: máximo 20 intentos de subida y 120 descargas en una ventana móvil de una hora.
- El MIME se valida como tipo declarativo, no se considera una prueba de la naturaleza real del archivo. Las descargas siempre son attachment con nosniff.

Estos valores son límites iniciales del producto en files; cuotas configurables y políticas adicionales siguen siendo trabajo de las Fases 6 y 8.

## Integración de interfaz

- [x] El navegador sube archivos de hasta 95 MiB a `POST /api/files` usando `X-File-Name`, `X-File-Size`, el MIME declarativo y, cuando corresponde, `X-File-Folder-Id`.
- [x] Los archivos mayores usan sesiones multipart autenticadas y fragmentos de 16 MiB a través del mismo origen; el Worker conserva el ID R2 y los ETags en estado privado del módulo files.
- [x] La interfaz envía archivos de más de 95 MiB mediante multipart; el backend valida tamaño real, sesión y propiedad de cada fragmento.\n- [x] La cola permite pausar/reanudar transferencias, cancelar archivos y lotes de carpeta, retirar archivos pendientes y distinguir estados pausado/cancelado/error/completado.\n- [x] Los fragmentos multipart reintentan errores de red y HTTP 5xx hasta tres veces antes de marcar error; el backend registra fallos de escritura de fragmentos para facilitar diagnóstico.
- [x] Las filas de archivos ofrecen descarga a través de `GET /api/files/:id/download`, que conserva la autorización y el streaming privado del Worker.
- [x] Las transferencias usan mismo origen, cookies same-origin y `cache: no-store`; no se configura acceso a R2 desde el cliente.
- [ ] La integración de interfaz no cierra la fase: la evidencia operativa al final de este documento sigue siendo obligatoria.

## Pruebas añadidas

- HTTP del BFF real con sesiones autenticadas para subida, descarga completa, rango parcial, rango inválido y rechazo de acceso cruzado.
- Rechazo cuando el tamaño real del stream no coincide con el declarado.
- Reservas de capacidad y límite de transferencias por propietario.
- Localización de subidas vencidas/fallidas para la limpieza programada.
- El fake de R2 se usa solamente en pruebas; no se incorpora al Worker de producción.

## Verificación y despliegue

La migración src/modules/files/infrastructure/persistence/d1/migrations/0003_files_transfers.sql agrega files_transfer_events e índices propios del módulo. pnpm run deploy usa el preflight antes de aplicar migraciones remotas, comprueba el esquema D1 y solo entonces publica Worker y verifica /api/health. La nueva migración no debe editarse después de haber sido aplicada en un entorno compartido.

## Evidencia operativa pendiente

- [ ] Verificar en el panel que vega-drive-files permanece privado, no tiene dominio público ni r2.dev, y CORS solo permite los orígenes autorizados, métodos GET/PUT, cabeceras Content-Type/If-None-Match y expone ETag.
- [ ] Confirmar permisos mínimos del binding/credenciales limitados a ese bucket.
- [ ] Desplegar la versión candidata por el procedimiento documentado, no con wrangler deploy --dry-run.
- [ ] Ejecutar en producción una subida/descarga E2E con un archivo de prueba, comprobar rango parcial y probar que una segunda cuenta no puede descargarlo.
- [ ] Adjuntar el SHA desplegado y el resultado verificable a la evidencia de fase, sin copiar credenciales o cookies.

No llamar 100 % cerrada a la Fase 4 hasta resolver la lista de evidencia operativa anterior.

## Migración a transferencia directa (ADR-001)

- Las subidas de hasta 95 MiB pueden crear una sesión de PUT firmado, subir el
  cuerpo directamente a R2 y confirmar mediante `HEAD` antes de registrar
  metadatos.
- Tanto la subida directa simple como la finalización multipart comparan el
  tamaño y el `Content-Type` devueltos por `HEAD` con la sesión autorizada
  antes de publicar el catálogo. Una discrepancia rechaza la finalización y
  activa la limpieza/reconciliación existente; si falla la limpieza, el cierre
  operativo de la fase sigue pendiente.
- Las subidas grandes conservan la sesión/reserva en D1 y pueden pedir URLs
  firmadas por parte; el navegador envía cada parte a R2 y confirma el ETag al
  Worker. El Worker conserva la autoridad sobre la lista de partes y completa
  el multipart. La compatibilidad de IDs/ETags entre la API de bindings y la
  API S3 debe probarse en E2E antes de habilitar el flag.
- Las descargas pueden redirigir a una URL GET firmada de 120 segundos, emitida
  después de validar propiedad, carpeta activa, cuota de frecuencia y tamaño
  real. La URL es una credencial portadora hasta expirar; no hay revocación
  instantánea garantizada.
- Configuración requerida fuera del repositorio: secretos del Worker
  `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`;
  `DIRECT_R2_TRANSFERS_ENABLED` permanece `false` hasta que CORS permita solo
  orígenes conocidos, métodos PUT/GET y cabeceras mínimas, exponiendo `ETag`
  para multipart.
- Las URLs no se guardan en almacenamiento local ni se escriben en logs. Las
  credenciales S3 deben tener permisos mínimos limitados al bucket
  `vega-drive-files`.
- El modo antiguo permanece como rollback cuando la autorización directa no
  está habilitada o no está configurada. No se afirma que CI certifique límites
  de CPU ni capacidad para 20 usuarios; se requieren pruebas de carga
  controlada.
