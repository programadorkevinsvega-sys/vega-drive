import type { FilesFileView } from "./files-contract";
import { FilesApiError } from "./files-api-error";
import { parseFileResponse, requestJson } from "./files-transfer-http";
import {
  UploadCancelledError,
  UploadPausedError,
  UploadController,
} from "./files-transfer-controller";

const MULTIPART_PART_BYTES = 16 * 1024 * 1024;
type UploadProgressListener = (percentage: number) => void;

interface MultipartStart {
  uploadId: string;
  partSizeBytes: number;
  totalParts: number;
}

export async function uploadMultipartFile(
  file: File,
  folderId: string | null,
  onProgress: UploadProgressListener | undefined,
  control: UploadController,
): Promise<FilesFileView> {
  // No abortamos la creación de sesión: si el servidor ya la creó,
  // necesitamos recibir su ID para reanudarla o limpiarla al cancelar.
  const started = await requestJson<MultipartStart>(
    "POST",
    "/api/files/multipart",
    JSON.stringify({
      name: file.name,
      folderId,
      sizeBytes: file.size,
      contentType: file.type || "application/octet-stream",
    }),
    { "Content-Type": "application/json" },
  );
  if (
    !started ||
    typeof started.uploadId !== "string" ||
    started.partSizeBytes !== MULTIPART_PART_BYTES ||
    !Number.isSafeInteger(started.totalParts) ||
    started.totalParts < 2
  ) {
    throw new FilesApiError(
      "El servidor devolvió una sesión de subida inválida.",
      500,
    );
  }

  const abortSession = async () => {
    try {
      await requestJson(
        "POST",
        "/api/files/multipart/" +
          encodeURIComponent(started.uploadId) +
          "/abort",
        null,
      );
    } catch {
      // La limpieza de sesiones expiradas es la última defensa.
    }
  };

  try {
    if (control.cancelled) throw new UploadCancelledError();
    for (let index = 0; index < started.totalParts; ) {
      await control.waitUntilReady();
      const start = index * started.partSizeBytes;
      const chunk = file.slice(
        start,
        Math.min(start + started.partSizeBytes, file.size),
      );
      const partNumber = index + 1;
      let attempts = 0;
      while (true) {
        try {
          await requestJson<{ partNumber: number }>(
            "PUT",
            "/api/files/multipart/" +
              encodeURIComponent(started.uploadId) +
              "/parts/" +
              partNumber,
            chunk,
            {
              "Content-Type": "application/octet-stream",
              "X-Part-Size": String(chunk.size),
            },
            (loaded) =>
              onProgress?.(
                Math.min(99, Math.floor(((start + loaded) / file.size) * 100)),
              ),
            chunk.size,
            control,
          );
          index += 1;
          break;
        } catch (error) {
          if (control.cancelled) throw new UploadCancelledError();
          if (control.paused || error instanceof UploadPausedError) {
            await control.waitUntilReady();
            // El fragmento interrumpido se reenvía con el mismo número de
            // parte.
            break;
          }
          const retryable =
            error instanceof FilesApiError &&
            (error.status === 0 ||
              error.status === 408 ||
              error.status === 425 ||
              error.status === 429 ||
              error.status >= 500);
          // Una parte puede fallar por una interrupción temporal del Worker,
          // R2 o D1. Reintentamos la misma parte antes de abortar la sesión.
          if (!retryable || attempts >= 5) throw error;
          attempts += 1;
          await new Promise<void>((resolve) =>
            setTimeout(resolve, Math.min(8000, 500 * 2 ** (attempts - 1))),
          );
          await control.waitUntilReady();
        }
      }
    }
    await control.waitUntilReady();
    const result = await requestJson<unknown>(
      "POST",
      "/api/files/multipart/" +
        encodeURIComponent(started.uploadId) +
        "/complete",
      null,
    );
    const uploadedFile = parseFileResponse(result, 201);
    onProgress?.(100);
    return uploadedFile;
  } catch (error) {
    await abortSession();
    if (control.cancelled) throw new UploadCancelledError();
    throw error;
  }
}

