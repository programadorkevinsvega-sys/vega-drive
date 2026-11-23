import { useState } from "react";
import { Button } from "../ui/Button";
import { Icon } from "../ui/Icon";
import { TextField } from "../ui/TextField";
import type { Route } from "../router/routes";

export function ShareAccessScreen({ token }: Extract<Route, { name: "share" }>) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [password, setPassword] = useState("");
  async function download() {
    if (loading) return;
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/shares/access", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json", Accept: "application/octet-stream" },
        body: JSON.stringify({ token, ...(password ? { password } : {}) }),
      });
      if (!response.ok) {
        setError(response.status === 404 ? "Este enlace no existe, venció o fue revocado." : "No se pudo acceder al archivo. Inténtalo de nuevo.");
        return;
      }
      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition") ?? "";
      const encoded = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
      const filename = encoded ? decodeURIComponent(encoded) : "archivo-compartido";
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl; anchor.download = filename; anchor.rel = "noopener";
      document.body.append(anchor); anchor.click(); anchor.remove();
      URL.revokeObjectURL(objectUrl);
    } catch { setError("No se pudo conectar con el servidor."); }
    finally { setLoading(false); }
  }
  return <main className="vd-share-access">
    <section className="vd-panel vd-share-access__panel">
      <span className="vd-share-access__icon"><Icon name="file" size="lg" /></span>
      <h1 className="vd-page__title">Archivo compartido</h1>
      <p>Este enlace permite descargar un único archivo. No concede acceso a otras carpetas ni archivos.</p>
      <TextField label="Contraseña (si fue solicitada)" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} />
      <Button icon="file" loading={loading} onClick={() => void download()}>Descargar archivo</Button>
      {error ? <p className="vd-catalog__form-error" role="alert">{error}</p> : null}
      <p className="vd-share-access__privacy">El enlace puede dejar de funcionar si vence o si su propietario lo revoca.</p>
    </section>
  </main>;
}
