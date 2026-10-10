import type { ProfileService } from "../services/profile-service";

/**
 * SIMULADO. Perfil ficticio con retardo artificial para ensayar el estado de
 * carga. El dominio .invalid esta reservado y nunca corresponde a un correo
 * real. No proviene de ninguna cuenta ni de Cloudflare D1.
 */
export function createMockProfileService(delayMs = 350): ProfileService {
  return {
    getCurrentProfile: () =>
      new Promise((resolve) => {
        setTimeout(() => {
          resolve({
            displayName: "Perfil de ejemplo",
            email: "sin-cuenta@ejemplo.invalid",
          });
        }, delayMs);
      }),
  };
}
