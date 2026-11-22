import { FilesApiError } from "../services/files-service";

export function dateLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function errorLabel(cause: unknown): string {
  return cause instanceof FilesApiError
    ? cause.message
    : "No se pudieron cargar los archivos recientes. Inténtalo de nuevo.";
}
