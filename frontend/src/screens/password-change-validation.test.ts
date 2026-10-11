import { describe, expect, it } from "vitest";
import { validatePasswordChange } from "./password-change-validation";

const validValues = {
  currentPassword: "old-test-value",
  newPassword: "a-long-test-value-12",
  confirmPassword: "a-long-test-value-12",
};

describe("validación del formulario de cambio de contraseña", () => {
  it("requiere la contraseña actual", () => {
    expect(
      validatePasswordChange({ ...validValues, currentPassword: "" }),
    ).toMatchObject({
      valid: false,
      field: "currentPassword",
    });
  });

  it("limita la contraseña actual a 128 caracteres", () => {
    expect(
      validatePasswordChange({
        ...validValues,
        currentPassword: "x".repeat(129),
      }),
    ).toMatchObject({
      valid: false,
      field: "currentPassword",
    });
  });

  it("exige una nueva contraseña de al menos 12 caracteres", () => {
    expect(
      validatePasswordChange({
        ...validValues,
        newPassword: "short",
        confirmPassword: "short",
      }),
    ).toMatchObject({
      valid: false,
      field: "newPassword",
    });
  });

  it("rechaza una nueva contraseña que supere 128 caracteres", () => {
    const tooLong = "x".repeat(129);
    expect(
      validatePasswordChange({
        ...validValues,
        newPassword: tooLong,
        confirmPassword: tooLong,
      }),
    ).toMatchObject({
      valid: false,
      field: "newPassword",
    });
  });

  it("requiere que la confirmación coincida exactamente", () => {
    expect(
      validatePasswordChange({
        ...validValues,
        confirmPassword: "another-long-test-value",
      }),
    ).toMatchObject({
      valid: false,
      field: "confirmPassword",
    });
  });

  it("acepta valores que cumplen las validaciones del formulario", () => {
    expect(validatePasswordChange(validValues)).toEqual({ valid: true });
  });
});
