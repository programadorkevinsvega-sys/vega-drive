export type ClassValue = string | false | null | undefined;

/** Une nombres de clase ignorando los valores vacios. */
export function cx(...parts: ClassValue[]): string {
  return parts.filter(Boolean).join(" ");
}
