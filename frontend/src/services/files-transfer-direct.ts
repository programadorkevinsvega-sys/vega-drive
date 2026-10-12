import type { FilesFileView } from "./files-contract";
import { FilesApiError } from "./files-api-error";
import { parseFileResponse, requestJson } from "./files-transfer-http";
import {
  UploadCancelledError,
  UploadPausedError,
  UploadController,
} from "./files-transfer-controller";

interface DirectUploadStart {
  uploadId: string;
  url: string;
  expiresInSeconds: number;
}

export async function tryDirectSingleUpload(
  file: File,
  folderId: string | null,
  onProgress: ((percentage: number) => void) | undefined,
  control: UploadController,
): Promise<FilesFileView | null> {
  let started: DirectUploadStart;
  try {
    started = await requestJson<DirectUploadStart>(
      "POST",
      "/api/files/direct",
      JSON.stringify({
        name: file.name,
        folderId,
        sizeBytes: file.size,
        contentType: file.type || "application/octet-stream",
      }),
      { "Content-Type": "application/json" },
    );
  } catch (error) {
    if (error instanceof FilesApiError && [404, 503].includes(error.status)) {
      return null;
    }
    throw error;
  }
  if (
    !started ||
    typeof started.uploadId !== "string" ||
    typeof started.url !== "string" ||
    !Number.isSafeInteger(started.expiresInSeconds) ||
    started.expiresInSeconds < 1
  ) {
    throw new FilesApiError(
      "El servidor devolvió una autorización de subida inválida.",
      500,
    );
  }

  const abortSession = async () => {
    try {
      await requestJson(
        "POST",
        "/api/files/direct/" +
          encodeURIComponent(started.uploadId) +
          "/abort",
        null,
      );
    } catch {
      // The server's expiry cleanup remains the final safety net.
    }
  };

  try {
    await control.waitUntilReady();
    await new Promise<void>((resolve, reject) => {
      const request = new XMLHttpRequest();
      let settled = false;
      const finish = (callback: () => void) => {
        if (settled) return;
        settled = true;
        control.detach(request);
        callback();
      };
      request.open("PUT", started.url, true);
      request.setRequestHeader(
        "Content-Type",
        file.type || "application/octet-stream",
      );
      request.setRequestHeader("If-None-Match", "*");
      control.attach(request);
      request.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable && file.size > 0) {
          onProgress?.(
            Math.min(95, Math.floor((event.loaded / event.total) * 95)),
          );
        }
      });
      request.addEventListener("error", () =>
        finish(() =>
          reject(
            new FilesApiError("La conexión con el almacenamiento falló.", 0),
          ),
        ),
      );
      request.addEventListener("abort", () =>
        finish(() => {
          if (control.cancelled) reject(new UploadCancelledError());
          else if (control.paused) reject(new UploadPausedError());
          else reject(new FilesApiError("La subida directa se interrumpió.", 0));
        }),
      );
      request.addEventListener("load", () =>
        finish(() => {
          if (request.status < 200 || request.status >= 300) {
            reject(
              new FilesApiError(
                "El almacenamiento rechazó la subida directa.",
                request.status,
              ),
            );
          } else {
            resolve();
          }
        }),
      );
      request.send(file);
    });
    await control.waitUntilReady();
    const result = await requestJson<unknown>(
      "POST",
      "/api/files/direct/" +
        encodeURIComponent(started.uploadId) +
        "/complete",
      null,
    );
    const uploaded = parseFileResponse(result, 201);
    onProgress?.(100);
    return uploaded;
  } catch (error) {
    await abortSession();
    if (control.cancelled) throw new UploadCancelledError();
    if (error instanceof FilesApiError && error.status === 403) {
      // A long pause can outlive the signed URL; retry through the safe API path.
      return null;
    }
    throw error;
  }
}

interface DirectPartAuthorization {
  url: string;
  partNumber: number;
  expectedSizeBytes: number;
  expiresInSeconds: number;
}

export async function tryDirectMultipartPart(
  uploadId: string,
  partNumber: number,
  chunk: Blob,
  onLoaded: (loaded: number) => void,
  control: UploadController,
): Promise<boolean> {
  let authorization: DirectPartAuthorization;
  try {
    authorization = await requestJson<DirectPartAuthorization>(
      "POST",
      "/api/files/multipart/" +
        encodeURIComponent(uploadId) +
        "/parts/" +
        partNumber +
        "/url",
      null,
    );
  } catch (error) {
    if (error instanceof FilesApiError && [404, 503].includes(error.status)) {
      return false;
    }
    throw error;
  }
  if (
    !authorization ||
    typeof authorization.url !== "string" ||
    authorization.partNumber !== partNumber ||
    authorization.expectedSizeBytes !== chunk.size ||
    authorization.expiresInSeconds < 1
  ) {
    throw new FilesApiError(
      "El servidor devolvió una autorización de fragmento inválida.",
      500,
    );
  }

  await control.waitUntilReady();
  const etag = await new Promise<string>((resolve, reject) => {
    const request = new XMLHttpRequest();
    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      control.detach(request);
      callback();
    };
    request.open("PUT", authorization.url, true);
    request.setRequestHeader("Content-Type", "application/octet-stream");
    control.attach(request);
    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) onLoaded(Math.min(event.loaded, chunk.size));
    });
    request.addEventListener("error", () =>
      finish(() => reject(new FilesApiError("La conexión con R2 falló.", 0))),
    );
    request.addEventListener("abort", () =>
      finish(() => {
        if (control.cancelled) reject(new UploadCancelledError());
        else if (control.paused) reject(new UploadPausedError());
        else reject(new FilesApiError("La parte se interrumpió.", 0));
      }),
    );
    request.addEventListener("load", () =>
      finish(() => {
        if (request.status < 200 || request.status >= 300) {
          reject(new FilesApiError("R2 rechazó la parte.", request.status));
          return;
        }
        const responseEtag = request.getResponseHeader("ETag");
        if (!responseEtag) {
          reject(new FilesApiError("R2 no expuso el ETag de la parte.", 0));
          return;
        }
        resolve(responseEtag);
      }),
    );
    request.send(chunk);
  });

  await requestJson(
    "POST",
    "/api/files/multipart/" +
      encodeURIComponent(uploadId) +
      "/parts/" +
      partNumber +
      "/confirm",
    JSON.stringify({ etag, sizeBytes: chunk.size }),
    { "Content-Type": "application/json" },
  );
  return true;
}
