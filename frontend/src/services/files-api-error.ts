export class FilesApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "FilesApiError";
    this.status = status;
  }
}

export function messageForStatus(status: number): string {
  if (status === 0) {
    return "No se pudo conectar con Vega Drive. Comprueba tu conexión e inténtalo de nuevo.";
  }
  if (status === 400) {
    return "La solicitud no es válida. Revisa los datos e inténtalo de nuevo.";
  }
  if (status === 401) {
    return "Tu sesión ya no es válida. Inicia sesión de nuevo.";
  }
  if (status === 403) {
    return "El servidor rechazó el origen de la solicitud.";
  }
  if (status === 404) {
    return "El elemento ya no está disponible o no pertenece a esta cuenta.";
  }
  if (status === 409) {
    return "Ya existe un elemento con ese nombre o el movimiento no es válido.";
  }
  if (status === 413) {
    return "El archivo supera el tamaño máximo permitido de 95 MiB.";
  }
  if (status === 429) {
    return "Se alcanzó el límite temporal de transferencias. Inténtalo más tarde.";
  }
  if (status === 503) {
    return "El catálogo no está disponible temporalmente. Inténtalo de nuevo.";
  }
  return "No se pudo completar la operación. Inténtalo de nuevo.";
}
