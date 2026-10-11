import { useEffect, useRef, useState } from "react";

interface TurnstileRenderOptions {
  sitekey: string;
  action: "register" | "login";
  callback(token: string): void;
  "expired-callback"(): void;
  "error-callback"(): void;
  "timeout-callback"(): void;
  theme?: "light" | "dark" | "auto";
}
interface TurnstileApi {
  render(container: HTMLElement, options: TurnstileRenderOptions): string;
  reset(widgetId?: string): void;
  remove?(widgetId: string): void;
}
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}
const SCRIPT_ID = "cloudflare-turnstile-api";
const SCRIPT_URL =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let scriptPromise: Promise<void> | null = null;

function loadTurnstile(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<void>((resolve, reject) => {
    let script = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    const fail = () => {
      scriptPromise = null;
      reject(new Error("No se pudo cargar Turnstile."));
    };
    const ready = () => {
      if (window.turnstile) resolve();
      else fail();
    };
    if (!script) {
      script = document.createElement("script");
      script.id = SCRIPT_ID;
      script.src = SCRIPT_URL;
      script.async = true;
      script.defer = true;
      script.addEventListener("load", ready, { once: true });
      script.addEventListener("error", fail, { once: true });
      document.head.appendChild(script);
    } else {
      script.addEventListener("load", ready, { once: true });
      script.addEventListener("error", fail, { once: true });
    }
  });
  return scriptPromise;
}

export function TurnstileWidget({
  siteKey,
  action,
  onToken,
  onError,
  resetKey,
}: {
  siteKey: string;
  action: "register" | "login";
  onToken(token: string): void;
  onError(): void;
  resetKey: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loadError, setLoadError] = useState(false);
  useEffect(() => {
    let disposed = false;
    let widgetId: string | null = null;
    setLoadError(false);
    onToken("");
    void loadTurnstile()
      .then(() => {
        if (disposed || !containerRef.current || !window.turnstile) return;
        widgetId = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          action,
          callback: (token) => onToken(token),
          "expired-callback": () => onToken(""),
          "error-callback": () => {
            onToken("");
            onError();
          },
          "timeout-callback": () => onToken(""),
          theme: "auto",
        });
      })
      .catch(() => {
        if (!disposed) {
          setLoadError(true);
          onError();
        }
      });
    return () => {
      disposed = true;
      if (widgetId && window.turnstile?.remove)
        window.turnstile.remove(widgetId);
    };
  }, [siteKey, action, resetKey, onToken, onError]);
  return (
    <div className="vd-auth__turnstile">
      <div ref={containerRef} />
      {loadError ? (
        <p className="vd-auth__inline-error" role="alert">
          No se pudo cargar Turnstile. Comprueba la conexión y vuelve a
          intentarlo.
        </p>
      ) : null}
    </div>
  );
}
