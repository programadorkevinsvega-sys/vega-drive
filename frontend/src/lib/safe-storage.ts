/**
 * Acceso defensivo a localStorage. Solo para preferencias de interfaz no
 * sensibles (hoy: tema visual). Nunca guardar contrasenas, tokens ni datos
 * de usuario aqui.
 */
export function readPreference(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writePreference(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Almacenamiento no disponible: la preferencia vive solo en memoria.
  }
}
