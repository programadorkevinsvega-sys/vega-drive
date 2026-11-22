const MAX_PREVIEW_BYTES = 25 * 1024 * 1024;

export async function fetchPreviewBytes(
  url: string,
  signal?: AbortSignal,
): Promise<ArrayBuffer> {
  const response = await fetch(url, {
    mode: "cors",
    credentials: "omit",
    cache: "no-store",
    referrerPolicy: "no-referrer",
    signal,
  });
  if (!response.ok) {
    throw new Error("R2 no pudo entregar el archivo para la vista previa.");
  }

  const rawLength = response.headers.get("Content-Length");
  if (rawLength !== null) {
    if (!/^\\d+$/.test(rawLength)) {
      throw new Error("R2 devolvió un tamaño de archivo no válido.");
    }
    if (Number(rawLength) > MAX_PREVIEW_BYTES) {
      throw new Error("Archivo mayor de 25 MB; descarga para verlo.");
    }
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("La respuesta de R2 no contiene un archivo legible.");
  }

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      totalBytes += part.value.byteLength;
      if (totalBytes > MAX_PREVIEW_BYTES) {
        await reader.cancel();
        throw new Error("Archivo mayor de 25 MB; descarga para verlo.");
      }
      chunks.push(part.value);
    }
  } finally {
    reader.releaseLock();
  }

  const result = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result.buffer;
}
