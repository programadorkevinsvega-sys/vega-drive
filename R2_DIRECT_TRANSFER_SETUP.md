# Configuración operativa de transferencias directas a R2

**Revisión documental: 2026-11-23.** Este runbook complementa [ADR-001](./ADR-001-direct-r2-transfers.md) y [FILES_PHASE_4.md](./FILES_PHASE_4.md). No autoriza cambios de configuración, rotación, activación/desactivación de flags ni despliegues.

## Estado confirmado y límites de lo conocido

El propietario confirmó el 2026-10-12 que en producción se completaron las validaciones de privacidad del bucket, CORS mínimo, permisos limitados, despliegue, subida/descarga real con comparación de bytes, rangos parciales y aislamiento entre cuentas. El bucket `vega-drive-files` se informó privado, con `r2.dev` y dominio público desactivados. Esta evidencia histórica sigue siendo el último estado operativo confirmado en este documento; no se presume que la configuración externa no haya cambiado desde entonces.

El código contiene la variable `DIRECT_R2_TRANSFERS_ENABLED`. **El valor efectivo actual de esa variable no se puede deducir del repositorio**: debe consultarse en la configuración de entorno del Worker antes de afirmar qué ruta está activa. No cambiarla como parte de una revisión documental.

## 1. Privacidad del bucket y CORS

Mantener el bucket privado, sin acceso público, sin dominio público y con `r2.dev` desactivado. CORS no es autorización y nunca debe usarse para hacer público el bucket.

La política operativa confirmada para transferencias directas contempla los orígenes exactos:
- `https://vega-drive.programadorkevinsvega.workers.dev`
- `https://drive.jnmtortas.com`

Métodos mínimos: `GET` y `PUT`. Encabezados permitidos: `Content-Type` e `If-None-Match`. Encabezados expuestos: `ETag`. Max age registrado: 3600 segundos. No usar `*`, no añadir el endpoint S3 como origen del navegador y no incorporar localhost a CORS de producción.

La vista previa de archivos no necesita CORS de R2: el navegador consume rutas same-origin autenticadas y el Worker transmite los bytes. CORS se aplica únicamente al flujo de transferencia directa autorizado.

## 2. Credenciales S3

- Las credenciales S3 deben tener permisos mínimos de lectura/escritura de objetos limitados al bucket `vega-drive-files`.
- Guardar `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID` y `R2_SECRET_ACCESS_KEY` como secretos del Worker, nunca en Git, `wrangler.toml`, frontend, logs ni este documento.
- No confundir un token de API de Cloudflare con Access Key ID/Secret Access Key S3 de R2: son credenciales distintas.
- Si alguna credencial se compartió en un lugar no autorizado, tratarla como expuesta, rotarla desde Cloudflare y comprobar el nuevo secreto sin mostrar su valor.
- No pedir ni copiar valores secretos en issues, commits, capturas o chats.

Comandos de configuración (solo cuando se apruebe una rotación/cambio; no ejecutar durante una auditoría documental):

```sh
pnpm exec wrangler secret put R2_ACCOUNT_ID
pnpm exec wrangler secret put R2_ACCESS_KEY_ID
pnpm exec wrangler secret put R2_SECRET_ACCESS_KEY
```

## 3. Flag y selección de flujo

`DIRECT_R2_TRANSFERS_ENABLED` controla la selección del flujo directo. La evidencia operativa de Fase 4 confirma que las transferencias se probaron en producción, pero no determina el valor actual del flag. Antes de diagnosticar una transferencia:
1. Consultar el valor efectivo en el entorno Worker, sin revelar secretos.
2. Confirmar que los secretos R2 necesarios existen y corresponden al bucket.
3. Confirmar privacidad/CORS/permisos en Cloudflare.
4. No activar ni desactivar el flag sin autorización explícita del propietario y un despliegue aprobado.

El flujo alternativo a través del Worker se conserva como mecanismo de respaldo. Una URL prefirmada es una credencial portadora hasta expirar; no prometer revocación instantánea.

## 4. Evidencia operativa de Fase 4

**Estado: COMPLETADO (2026-10-12, según confirmación explícita del propietario).**

- [x] Bucket privado, sin dominio público ni `r2.dev`.
- [x] CORS de producción con orígenes exactos, métodos y cabeceras mínimos; sin comodines.
- [x] Permisos de R2 limitados al bucket requerido.
- [x] Despliegue de migración/Worker correspondiente.
- [x] Subida y descarga reales con comparación de bytes.
- [x] Rango parcial y rechazo de acceso desde otra cuenta.
- [x] SHA desplegado y evidencia registrados por el propietario.

Esta confirmación no equivale a una auditoría actual del panel Cloudflare. Las siguientes pruebas adicionales no tienen evidencia operativa individual registrada en este documento y no deben presentarse como ejecutadas solo por CI:

- [ ] Prueba de carga/concurrencia controlada y métricas de capacidad.
- [ ] Prueba operativa adicional de expiración y alteración de URLs firmadas (método, objeto, encabezados y parte).
- [ ] Revisión periódica de rotación de credenciales y vigencia del valor de `DIRECT_R2_TRANSFERS_ENABLED`.

Las pruebas automatizadas de autorización, sesión y seguridad están integradas en CI; consulta [Security.md](./Security.md). CI no demuestra por sí sola la configuración actual de Cloudflare ni el estado efectivo del flag.

## 5. Seguridad de transferencias

- El Worker valida actor, propietario, estado, tamaño y permisos antes de emitir una URL.
- Cada URL autoriza una acción, objeto o parte concretos y tiene expiración corta.
- Las credenciales S3, claves internas y el identificador de objeto no se entregan como campos independientes al navegador.
- En multipart, el Worker conserva la sesión y la lista autoritativa de partes/ETags.
- La aplicación valida el objeto final mediante `HEAD` antes de registrar metadatos.
- Las URLs no se almacenan en localStorage ni se registran en logs.
- El flujo de vista previa nunca entrega URL R2; usa rutas same-origin con autorización en cada petición.

## Referencias

- [ADR-001 — Transferencias directas y autorizadas a R2](./ADR-001-direct-r2-transfers.md)
- [Fase 4 — Transferencias privadas con R2](./FILES_PHASE_4.md)
- [Vista previa privada](./FILES_PREVIEW.md)
- [Reglas de seguridad](./Security.md)
- [Operación y recuperación](./Rollback.md)
