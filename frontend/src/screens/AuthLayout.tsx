import { useCallback, useEffect, useState, type FormEvent } from "react";
import { VegaLogo } from "../brand/VegaLogo";
import { useDocumentTitle } from "../lib/use-document-title";
import { navigate } from "../router/use-route";
import type { Route } from "../router/routes";
import {
  getAuthConfig,
  IdentityApiError,
  register,
} from "../services/identity-service";
import { useAuth } from "../services/auth-context";
import { TurnstileWidget } from "../services/TurnstileWidget";
import { ThemeToggle } from "../theme/ThemeToggle";
import { Button } from "../ui/Button";
import { AuthFields } from "./AuthFields";

export interface AuthLayoutProps {
  route: Route;
}
export function AuthLayout({ route }: AuthLayoutProps) {
  const isLogin = route.name === "login";
  const title = isLogin ? "Iniciar sesión" : "Crear cuenta";
  const { status, signIn } = useAuth();
  const [siteKey, setSiteKey] = useState("");
  const [configReady, setConfigReady] = useState(false);
  const [configError, setConfigError] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [resetKey, setResetKey] = useState(0);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  useDocumentTitle(title);

  const handleToken = useCallback((value: string) => setToken(value), []);
  const handleWidgetError = useCallback(() => {
    setToken("");
    setError(
      "No se pudo completar la verificación de seguridad. Inténtalo de nuevo.",
    );
  }, []);

  useEffect(() => {
    let active = true;
    void getAuthConfig()
      .then((config) => {
        if (!active) return;
        if (!config.ready || !config.turnstileSiteKey) {
          setConfigError(
            "El acceso no está disponible porque Turnstile no está configurado en el servidor.",
          );
          return;
        }
        setSiteKey(config.turnstileSiteKey);
        setConfigReady(true);
      })
      .catch(() => {
        if (active)
          setConfigError(
            "No se pudo consultar la configuración de autenticación. Recarga la página para intentarlo de nuevo.",
          );
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (status === "authenticated") navigate({ name: "drive", folderId: null });
  }, [status]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (!configReady) {
      setError(
        configError || "La verificación de seguridad todavía no está lista.",
      );
      return;
    }
    if (!token) {
      setError("Completa la verificación de seguridad antes de continuar.");
      return;
    }
    if (password.length < 12 || password.length > 128) {
      setError("La contraseña debe tener entre 12 y 128 caracteres.");
      return;
    }

    setLoading(true);
    const submittedToken = token;
    setToken("");
    try {
      if (isLogin) {
        await signIn(email.trim(), password, submittedToken);
        navigate({ name: "drive", folderId: null });
      } else {
        await register(email.trim(), password, submittedToken);
        setPassword("");
        setMessage("Cuenta creada correctamente. Ya puedes iniciar sesión.");
        navigate({ name: "login" });
      }
    } catch (cause) {
      setError(
        cause instanceof IdentityApiError
          ? cause.message
          : "No se pudo completar la solicitud. Inténtalo de nuevo.",
      );
    } finally {
      setLoading(false);
      setResetKey((value) => value + 1);
    }
  }

  return (
    <div className="vd-auth">
      <div className="vd-auth__tools">
        <ThemeToggle />
      </div>
      <main className="vd-auth__panel">
        <a href="#/login" className="vd-auth__brand" aria-label="Vega Drive">
          <VegaLogo />
        </a>
        <h1 className="vd-auth__title">{title}</h1>
        <p className="vd-auth__text">
          {isLogin
            ? "Accede a tu espacio privado de Vega Drive."
            : "Crea tu cuenta para comenzar a usar Vega Drive."}
        </p>
        {status === "unavailable" ? (
          <p className="vd-auth__notice" role="status">
            No se pudo comprobar una sesión existente. Puedes volver a
            intentarlo recargando la página.
          </p>
        ) : null}
        {configError ? (
          <p className="vd-auth__inline-error" role="alert">
            {configError}
          </p>
        ) : null}
        {message ? (
          <p className="vd-auth__success" role="status">
            {message}
          </p>
        ) : null}
        {error ? (
          <p className="vd-auth__inline-error" role="alert">
            {error}
          </p>
        ) : null}
        <form
          className="vd-auth__form"
          onSubmit={(event) => void handleSubmit(event)}
        >
          <AuthFields
            isLogin={isLogin}
            email={email}
            setEmail={setEmail}
            password={password}
            setPassword={setPassword}
            loading={loading}
            showPassword={showPassword}
            setShowPassword={setShowPassword}
          />
          {configReady ? (
            <TurnstileWidget
              key={resetKey}
              siteKey={siteKey}
              onToken={handleToken}
              onError={handleWidgetError}
              resetKey={resetKey}
            />
          ) : (
            <p className="vd-auth__notice" role="status">
              Cargando verificación de seguridad…
            </p>
          )}
          <Button
            type="submit"
            fullWidth
            loading={loading}
            disabled={loading || status === "loading" || !configReady || !token}
          >
            {isLogin ? "Iniciar sesión" : "Crear cuenta"}
          </Button>
        </form>
        <p className="vd-auth__footer">
          {isLogin ? "¿Todavía no tienes cuenta?" : "¿Ya tienes una cuenta?"}{" "}
          <a href={isLogin ? "#/register" : "#/login"}>
            {isLogin ? "Crear cuenta" : "Iniciar sesión"}
          </a>
        </p>
      </main>
    </div>
  );
}
