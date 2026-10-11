import { useState, type FormEvent } from "react";
import { changePassword, IdentityApiError } from "../services/identity-service";
import { Breadcrumbs } from "../ui/Breadcrumbs";
import { Button } from "../ui/Button";
import { PasswordField } from "./PasswordField";
import {
  validatePasswordChange,
  type PasswordChangeField,
} from "./password-change-validation";

const DRIVE_HOME = { label: "Mi unidad", href: "#/drive" };

export function PasswordSettingsScreen() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<PasswordChangeField, string>>
  >({});

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    const validation = validatePasswordChange({
      currentPassword,
      newPassword,
      confirmPassword,
    });
    if (!validation.valid) {
      setFieldErrors({ [validation.field]: validation.message });
      return;
    }

    setFieldErrors({});
    setLoading(true);
    try {
      await changePassword(currentPassword, newPassword);
      setSuccess(
        "Contraseña actualizada. Esta sesión se renovó y las demás sesiones se cerraron.",
      );
    } catch (cause) {
      setError(
        cause instanceof IdentityApiError && cause.status === 0
          ? "No se pudo conectar con Vega Drive. Comprueba tu conexión e inténtalo de nuevo."
          : "No se pudo cambiar la contraseña. Comprueba la contraseña actual y que la nueva cumpla los requisitos.",
      );
    } finally {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setLoading(false);
    }
  }

  function clearFieldError(field: PasswordChangeField) {
    setFieldErrors((previous) => {
      const next = { ...previous };
      delete next[field];
      if (field === "newPassword") delete next.confirmPassword;
      return next;
    });
  }

  return (
    <div className="vd-settings">
      <Breadcrumbs items={[DRIVE_HOME, { label: "Ajustes" }]} />
      <header className="vd-settings__heading">
        <h1 className="vd-page__title">Ajustes</h1>
        <p className="vd-settings__description">
          Administra la seguridad de tu cuenta de Vega Drive.
        </p>
      </header>

      <section
        className="vd-panel vd-settings__section"
        aria-labelledby="vd-settings-security-title"
      >
        <div className="vd-settings__section-heading">
          <h2 id="vd-settings-security-title">Seguridad de la cuenta</h2>
          <p>
            Cambia tu contraseña periódicamente y no la reutilices en otros
            servicios.
          </p>
        </div>

        <div className="vd-settings__card">
          <div className="vd-settings__card-heading">
            <h3>Cambiar contraseña</h3>
            <p>
              Necesitarás tu contraseña actual para confirmar este cambio.
            </p>
          </div>

          {success ? (
            <p
              className="vd-settings__feedback vd-settings__feedback--success"
              role="status"
              aria-live="polite"
            >
              {success}
            </p>
          ) : null}
          {error ? (
            <p
              className="vd-settings__feedback vd-settings__feedback--error"
              role="alert"
            >
              {error}
            </p>
          ) : null}

          <form
            className="vd-settings__form"
            onSubmit={(event) => void handleSubmit(event)}
            noValidate
          >
            <PasswordField
              label="Contraseña actual"
              name="currentPassword"
              value={currentPassword}
              autoComplete="current-password"
              onChange={(value) => {
                setCurrentPassword(value);
                clearFieldError("currentPassword");
              }}
              loading={loading}
              error={fieldErrors.currentPassword}
              hint={undefined}
              showLabel="Mostrar contraseña actual"
              hideLabel="Ocultar contraseña actual"
            />

            <PasswordField
              label="Nueva contraseña"
              name="newPassword"
              value={newPassword}
              autoComplete="new-password"
              onChange={(value) => {
                setNewPassword(value);
                clearFieldError("newPassword");
              }}
              loading={loading}
              error={fieldErrors.newPassword}
              hint="Usa entre 12 y 128 caracteres y evita contraseñas comunes o fáciles de adivinar."
              showLabel="Mostrar nueva contraseña"
              hideLabel="Ocultar nueva contraseña"
            />

            <PasswordField
              label="Confirmar nueva contraseña"
              name="confirmPassword"
              value={confirmPassword}
              autoComplete="new-password"
              onChange={(value) => {
                setConfirmPassword(value);
                clearFieldError("confirmPassword");
              }}
              loading={loading}
              error={fieldErrors.confirmPassword}
              hint={undefined}
              showLabel="Mostrar confirmación"
              hideLabel="Ocultar confirmación"
            />

            <Button
              type="submit"
              fullWidth
              loading={loading}
              disabled={loading}
            >
              Cambiar contraseña
            </Button>
          </form>

          <p className="vd-settings__security-note">
            Al guardar, el servidor renovará esta sesión y revocará las demás.
            Las contraseñas no se guardan en almacenamiento local ni se
            escriben en los registros de la aplicación.
          </p>
        </div>
      </section>
    </div>
  );
}
