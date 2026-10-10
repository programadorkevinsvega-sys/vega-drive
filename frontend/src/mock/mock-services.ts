import type { Services } from "../services/services";
import { createMockProfileService } from "./mock-profile-service";

/** Unico punto donde se eligen los adaptadores simulados (ver main.tsx). */
export function createMockServices(): Services {
  return { mode: "mock", profile: createMockProfileService() };
}
