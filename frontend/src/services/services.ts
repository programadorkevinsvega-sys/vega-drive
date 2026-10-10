import type { ProfileService } from "./profile-service";

/** Origen de los datos. "mock" = simulados en el navegador; no hay otro aun. */
export type DataMode = "mock";

export interface Services {
  mode: DataMode;
  profile: ProfileService;
}
