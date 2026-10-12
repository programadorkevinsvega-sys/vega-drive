import { FilesApiError } from "./files-api-error";
import { requestJson } from "./files-transfer-http";
import {
  UploadCancelledError,
  UploadPausedError,
  UploadController,
} from "./files-transfer-controller";

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
  let etag: string;
  try {
    etag = await new Promise<string>((resolve, reject) => {
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
  } catch (error) {
    if (
      error instanceof FilesApiError &&
      (error.status === 0 || error.status === 403)
    ) {
      return false;
    }
    throw error;
  }

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
