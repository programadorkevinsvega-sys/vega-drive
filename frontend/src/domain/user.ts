/** Datos de presentacion del perfil. No contienen roles ni permisos. */
export interface UserProfile {
  displayName: string;
  email: string;
}

/** Iniciales (maximo dos) para el avatar; "?" si no hay nombre util. */
export function initialsOf(displayName: string): string {
  const words = displayName.trim().split(/\s+/).filter(Boolean);
  const letters = words.slice(0, 2).map((word) => Array.from(word)[0] ?? "");
  const initials = letters.join("").toLocaleUpperCase("es");
  return initials || "?";
}
