import type { ModuleStatus } from "../../worker/env.js";
export interface QuotaPublicApi {
  status(): ModuleStatus;
}
