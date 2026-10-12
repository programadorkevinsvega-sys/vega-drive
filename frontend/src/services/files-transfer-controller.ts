export class UploadCancelledError extends Error {
  constructor() {
    super("La subida se canceló.");
    this.name = "UploadCancelledError";
  }
}

export class UploadPausedError extends Error {
  constructor() {
    super("La subida está pausada.");
    this.name = "UploadPausedError";
  }
}

/** Control compartido por la cola y el transporte HTTP de cada archivo. */
export export class UploadController {
  paused = false;
  cancelled = false;
  private request: XMLHttpRequest | null = null;
  private waiters: Array<() => void> = [];

  pause() {
    if (this.cancelled || this.paused) return;
    this.paused = true;
    this.request?.abort();
  }

  resume() {
    if (this.cancelled) return;
    this.paused = false;
    this.wake();
  }

  cancel() {
    if (this.cancelled) return;
    this.cancelled = true;
    this.paused = false;
    this.request?.abort();
    this.wake();
  }

  async waitUntilReady(): Promise<void> {
    while (this.paused && !this.cancelled) {
      await new Promise<void>((resolve) => this.waiters.push(resolve));
    }
    if (this.cancelled) throw new UploadCancelledError();
  }

  attach(request: XMLHttpRequest) {
    this.request = request;
  }

  detach(request: XMLHttpRequest) {
    if (this.request === request) this.request = null;
  }

  private wake() {
    for (const resolve of this.waiters.splice(0)) resolve();
  }
}


export type UploadProgressListener = (percentage: number) => void;
