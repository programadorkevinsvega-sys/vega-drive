export interface Env {
  ASSETS: Fetcher;
  VEGA_DRIVE_DB: D1Database;
  FILES_BUCKET: R2Bucket;
  TURNSTILE_SECRET_KEY: string;
  TURNSTILE_SITE_KEY: string;
  TURNSTILE_HOSTNAMES: string;
  MAX_USERS: string;
  /** Optional S3 credentials for direct signed R2 transfers; secrets stay server-side. */
  R2_ACCOUNT_ID?: string;
  R2_ACCESS_KEY_ID?: string;
  R2_SECRET_ACCESS_KEY?: string;
  DIRECT_R2_TRANSFERS_ENABLED?: string;
}

export interface ModuleStatus {
  module: "identity" | "files" | "quota" | "sharing";
  /** False until the module's real dependencies and behavior are implemented. */
  ready: boolean;
}
