export interface Env { ASSETS: Fetcher; VEGA_DRIVE_DB: D1Database; FILES_BUCKET: R2Bucket; TURNSTILE_SECRET_KEY: string; TURNSTILE_SITE_KEY: string; MAX_USERS: string; }
export interface ModuleStatus { module: "identity" | "files" | "quota" | "sharing"; ready: true; }
