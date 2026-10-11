export interface PasswordChangeValues {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export type PasswordChangeField =
  | "currentPassword"
  | "newPassword"
  | "confirmPassword";

export type PasswordChangeValidation =
  | { valid: true }
  | { valid: false; field: PasswordChangeField; message: string };

export function validatePasswordChange(
  values: PasswordChangeValues,
): PasswordChangeValidation {
  if (!values.currentPassword) {
    return {
      valid: false,
      field: "currentPassword",
      message: "Escribe tu contraseña actual.",
    };
  }

  if (values.currentPassword.length > 128) {
    return {
      valid: false,
      field: "currentPassword",
      message: "La contraseña actual no puede superar 128 caracteres.",
    };
  }

  if (values.newPassword.length < 12) {
    return {
      valid: false,
      field: "newPassword",
      message: "La nueva contraseña debe tener al menos 12 caracteres.",
    };
  }

  if (values.newPassword.length > 128) {
    return {
      valid: false,
      field: "newPassword",
      message: "La nueva contraseña no puede superar 128 caracteres.",
    };
  }

  if (values.confirmPassword !== values.newPassword) {
    return {
      valid: false,
      field: "confirmPassword",
      message: "Las contraseñas nuevas no coinciden.",
    };
  }

  return { valid: true };
}
