import type { UserProfile } from "../domain/user";

/**
 * Contrato de acceso al perfil. Hoy lo implementa solo un adaptador
 * simulado (src/mock). Mas adelante se podra sustituir por uno que consuma
 * el BFF bajo /api sin tocar las pantallas.
 */
export interface ProfileService {
  getCurrentProfile(): Promise<UserProfile>;
}
