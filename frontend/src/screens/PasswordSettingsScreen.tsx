import { useState, type FormEvent } from "react";
import { Breadcrumbs } from "../ui/Breadcrumbs";
import { Button } from "../ui/Button";
import { TextField } from "../ui/TextField";
import { changePassword, IdentityApiError } from "../services/identity-service";
import {
  validatePasswordChange,
  type PasswordChangeField,
} from "./password-change-validation";

const DRIVE_HOME = { label: "Mi unidad", href: "#/drive" };

export function PasswordSettingsScreen() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
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
      setShowCurrent(false);
      setShowNew(false);
      setShowConfirm(false);
      setLoading(false);
    }
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
            <p className="vd-settings__feedback vd-settings__feedback--success" role="status" aria-live="polite">
              {success}
            </p>
          ) : null}
          {error ? (
            <p className="vd-settings__feedback vd-settings__feedback--error" role="alert">
              {error}
            </p>
          ) : null}

          <form
            className="vd-settings__form"
            onSubmit={(event) => void handleSubmit(event)}
            noValidate
          >
            <TextField
              label="Contraseña actual"
              name="currentPassword"
              type={showCurrent ? "text" : "password"}
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) => {
                setCurrentPassword(event.target.value);
                setFieldErrors((previous) => ({
                  ...previous,
                  currentPassword: undefined,
                }));
              }}
              required
              maxLength={128}
              disabled={loading}
              error={fieldErrors.currentPassword}
              trailing={
                <button
                  type="button"
                  className="vd-auth__password-toggle"
                  onClick={() => setShowCurrent((value) => !value)}
                  aria-label={
                    showCurrent
                      ? "Ocultar contraseña actual"
                      : "Mostrar contraseña actual"
                  }
                  aria-pressed={showCurrent}
                  disabled={loading}
                >
                  {showCurrent ? "Ocultar" : "Mostrar"}
                </button>
              }
            />

            <TextField
              label="Nueva contraseña"
              name="newPassword"
              type={showNew ? "text" : "password"}
              autoComplete="new-password"
              value={newPassword}
              onChange={(event) => {
                setNewPassword(event.target.value);
                setFieldErrors((previous) => ({
                  ...previous,
                  newPassword: undefined,
                  confirmPassword: undefined,
                }));
              }}
              required
              minLength={12}
              maxLength={128}
              disabled={loading}
              error={fieldErrors.newPassword}
              hint="Usa entre 12 y 128 caracteres y evita contraseñas comunes o fáciles de adivinar."
              trailing={
                <button
                  type="button"
                  className="vd-auth__password-toggle"
                  onClick={() => setShowNew((value) => !value)}
                  aria-label={
                    showNew
                      ? "Ocultar nueva contraseña"
                      : "Mostrar nueva contraseña"
                  }
                  aria-pressed={showNew}
                  disabled={loading}
                >
                  {showNew ? "Ocultar" : "Mostrar"}
                </button>
              }
            />

            <TextField
              label="Confirmar nueva contraseña"
              name="confirmPassword"
              type={showConfirm ? "text" : "password"}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => {
                setConfirmPassword(event.target.value);
                setFieldErrors((previous) => ({
                  ...previous,
                  confirmPassword: undefined,
                }));
              }}
              required
              minLength={12}
              maxLength={128}
              disabled={loading}
              error={fieldErrors.confirmPassword}
              trailing={
                <button
                  type="button"
                  className="vd-auth__password-toggle"
                  onClick={() => setShowConfirm((value) => !value)}
                  aria-label={
                    showConfirm
                      ? "Ocultar confirmación"
                      : "Mostrar confirmación"
                  }
                  aria-pressed={showConfirm}
                  disabled={loading}
                >
                  {showConfirm ? "Ocultar" : "Mostrar"}
                </button>
              }
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
            Las contraseñas nunca se guardan en el navegador ni se muestran en
            los registros de la aplicación.
          </p>
        </div>
      </section>
    </div>
  );
}
