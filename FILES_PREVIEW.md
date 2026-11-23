# Vista previa privada de archivos

La vista previa usa un flujo autenticado del mismo origen. El navegador solicita
`/api/files/:id/preview` para obtener una ruta relativa y después consume
`/api/files/:id/preview/content`. El BFF valida la sesión y el propietario en
cada petición; el Worker transmite los bytes desde el almacenamiento privado.
No se entrega al navegador una URL firmada de R2 para la vista previa.

## Formatos y límites

- Imágenes rasterizadas, audio/vídeo compatibles con el navegador, PDF y
  texto.
- Markdown: títulos, listas, citas, bloques de código y enlaces seguros sin ejecutar HTML.
- DOCX: extracción local del texto principal. XLSX: primera hoja, máximo 500 filas y 100 columnas.
- HTML, SVG, JavaScript, ejecutables, DOC y XLS antiguos no se muestran en
  línea.
- Texto/DOCX/XLSX: máximo 25 MiB. El contenido no se envía a proveedores
  externos.

## CORS de R2

**La vista previa no necesita una política CORS de R2 para que el navegador
lea los bytes.** El navegador solo llama al BFF en el mismo origen; el Worker
lee R2 desde el servidor y transmite la respuesta. Por tanto, no se debe
habilitar acceso público, usar `*` como origen ni crear una excepción CORS
para hacer funcionar el visor.

CORS solo sería necesario para una futura ruta que haga que el navegador lea
directamente una URL de R2 (por ejemplo, transferencias directas desde el
cliente). Esa capacidad debe tener una política separada, limitada a los
orígenes oficiales, métodos y cabeceras estrictamente requeridos, y probarse
sin hacer público el bucket. No forma parte del flujo actual de vista previa.

## Autorización, expiración y solicitudes Range

- La ruta de metadatos devuelve una ruta relativa del mismo origen, no un token
  portador ni una URL firmada reutilizable.
- Tanto la ruta de metadatos como la ruta de contenido exigen sesión válida y
  comprueban que el archivo pertenezca al actor autenticado.
- La autorización efectiva expira con la sesión: cada petición vuelve a pasar
  por el middleware de autenticación. Revocar o dejar expirar la sesión impide
  consumir el contenido, aunque se conserve la ruta relativa.
- El contenido usa `Cache-Control: private, no-store`, `nosniff` y
  `Referrer-Policy: no-referrer`.
- Las solicitudes `Range` admiten respuestas parciales `206`; rangos no
  satisfacibles responden `416` con `Content-Range: bytes */<total>`.

## Pruebas automatizadas

La suite HTTP de Files verifica el flujo completo con dos usuarios:
metadatos same-origin, contenido inline, ausencia de URL/host R2 en el
contrato, ausencia de dependencia de CORS del navegador, sesión ausente o
expirada, rango parcial, rango inválido y rechazo de acceso cruzado (404).
Las pruebas usan R2 simulado y D1 aislado. `tests/files-catalog-http.test.ts`
cubre `200`, `206`, `416`, sesión ausente/expirada y acceso cruzado; `tests/files-preview-security.test.ts`
añade revocación de sesión, expiración antes de emitir metadatos y rangos de sufijo.
No sustituyen una prueba operativa con cuentas reales en producción.

Para una verificación manual adicional, abrir un archivo de cada formato
soportado desde Mi unidad y Recientes, y comprobar en Network que la petición
de contenido va a `drive.jnmtortas.com/api/files/.../preview/content` y no
directamente al host R2.


## Criterios de aceptación de seguridad

- El visor no requiere CORS de R2: no se debe añadir una regla de CORS público ni
  permitir `*` para el flujo de preview. El navegador solo habla con el BFF same-origin.
- La ruta relativa no es una credencial: no concede acceso por sí sola y no tiene
  una ventana de expiración independiente. La sesión se comprueba en cada petición.
- Una sesión vencida o revocada debe recibir `401`, incluso si ya obtuvo metadatos.
- El propietario distinto debe recibir `404` tanto en metadatos como en contenido.
- Los rangos válidos deben responder `206`; los no satisfacibles, `416` con el
  tamaño total en `Content-Range`.
- El bucket permanece privado y las respuestas de contenido no son cacheables.

La suite de arquitectura comprueba además que el BFF no importa módulos ni
accede directamente a D1/R2 y que el Worker mantiene un único composition root.
Identity y Files se consumen mediante sus gateways públicos; Quota y Sharing
siguen siendo placeholders limitados a `status()` con `ready: false`.
