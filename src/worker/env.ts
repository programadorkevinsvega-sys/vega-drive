export interface Env {
  ASSETS: Fetcher;
  VEGA_DRIVE_DB: D1Database;
  FILES_BUCKET: R2Bucket;
  TURNSTILE_SECRET_KEY: string;
  TURNSTILE_SITE_KEY: string;
  TURNSTILE_HOSTNAMES: string;
  MAX_USERS: string;
}

export interface ModuleStatus {
  module: "identity" | "files" | "quota" | "sharing";
  /** False until the module's real dependencies and behavior are implemented. */
  ready: boolean;
}
