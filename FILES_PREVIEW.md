# Vista previa privada de archivos

La vista previa utiliza URLs GET firmadas de R2 con vigencia máxima de 15
minutos. El Worker autoriza al actor, comprueba que el archivo y su ruta sigan
activos, registra la apertura y devuelve la URL; no retransmite los bytes.

## Formatos y límites

- Imágenes rasterizadas, audio/vídeo compatibles con el navegador, PDF y texto.
- DOCX: extracción local del texto principal. XLSX: valores de la primera hoja,
  máximo 500 filas.
- HTML, SVG, JavaScript, ejecutables, DOC y XLS antiguos no se muestran en línea.
- Texto/DOCX/XLSX: máximo 25 MiB. El contenido no se envía a proveedores externos.

## Configuración obligatoria de CORS en R2

En Cloudflare Dashboard → R2 → bucket privado vega-drive-files → Settings →
CORS Policy, configurar:

~~~json
[
  {
    "AllowedOrigins": [
      "https://drive.jnmtortas.com",
      "https://vega-drive.programadorkevinsvega.workers.dev"
    ],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["Range", "If-Range"],
    "ExposeHeaders": [
      "Accept-Ranges",
      "Content-Length",
      "Content-Range",
      "Content-Type",
      "ETag"
    ],
    "MaxAgeSeconds": 3600
  }
]
~~~

No habilitar acceso público ni usar origen wildcard. DOCX/XLSX y texto necesitan
CORS porque el navegador lee el contenido directamente; imágenes/vídeo nativos
no requieren que JavaScript lea los bytes.

## Validación

1. Abrir imagen, vídeo, PDF, TXT/MD, DOCX y XLSX desde Mi unidad y Recientes.
2. En DevTools → Network, confirmar que los bytes se descargan de
   *.r2.cloudflarestorage.com; /api/files/:id/preview solo devuelve metadatos y
   la URL.
3. Confirmar que HTML/SVG no se muestran como documentos activos y que no hay
   visores externos.
4. Probar acceso cruzado entre cuentas, URL expirada, solicitudes Range para
   vídeo/PDF y archivos no soportados.

La política CORS debe configurarse y probarse por separado; el código no
certifica esa configuración operativa.
