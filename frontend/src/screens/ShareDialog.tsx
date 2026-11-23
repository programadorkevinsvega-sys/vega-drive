import { useEffect, useState } from "react";
import { Button } from "../ui/Button";
import { TextField } from "../ui/TextField";
import { Modal } from "../ui/Modal";
import { useToast } from "../ui/toast-context";
import { createShare, listShares, revokeShare, type ShareEntry } from "../services/files-service";
import type { FilesFileView } from "../services/files-contract";

interface ShareDialogProps { file: FilesFileView | null; onClose: () => void; }
function dateLabel(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Fecha no disponible" : new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short" }).format(date);
}
export function ShareDialog({ file, onClose }: ShareDialogProps) {
  const [shares, setShares] = useState<ShareEntry[]>([]);
  const [lifetime, setLifetime] = useState("604800");
  const [password, setPassword] = useState("");
  const [createdLink, setCreatedLink] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { notify } = useToast();
  useEffect(() => {
    if (!file) return;
    let active = true;
    void listShares().then((result) => { if (active) setShares(result.shares.filter((share) => share.itemId === file.id)); })
      .catch(() => { if (active) setError("No se pudieron cargar los enlaces compartidos."); });
    return () => { active = false; };
  }, [file]);
  async function create() {
    if (!file || loading) return;
    setLoading(true); setError("");
    try {
      const result = await createShare(file.id, Number(lifetime), password || undefined);
      const link = window.location.origin + "/#/share/" + result.token;
      setCreatedLink(link);
      setShares((current) => [{ id: result.id, itemId: result.itemId, fileName: result.fileName, createdAt: result.createdAt, expiresAt: result.expiresAt, revokedAt: null }, ...current]);
    } catch { setError("No se pudo crear el enlace. Comprueba que el archivo siga disponible."); }
    finally { setLoading(false); }
  }
  async function copyLink() {
    try { await navigator.clipboard.writeText(createdLink); notify({ tone: "success", title: "Enlace copiado", description: "Compártelo solo con las personas autorizadas." }); }
    catch { setError("No se pudo copiar automáticamente. Selecciona y copia el enlace."); }
  }
  async function revoke(id: string) {
    try {
      await revokeShare(id);
      setShares((current) => current.map((share) => share.id === id ? { ...share, revokedAt: new Date().toISOString() } : share));
      notify({ tone: "success", title: "Enlace revocado", description: "El enlace ya no permite descargar el archivo." });
    } catch { setError("No se pudo revocar el enlace. Inténtalo de nuevo."); }
  }
  return (
    <Modal open={file !== null} onClose={onClose} title="Compartir archivo" description={file?.name ?? ""}>
      <div className="vd-share">
        <p className="vd-share__notice">El enlace permite descargar únicamente este archivo. Cualquier persona que tenga el enlace podrá acceder hasta su vencimiento o revocación.</p>
        <label className="vd-field">
          <span className="vd-field__label">El enlace vence en</span>
          <select className="vd-field__input" value={lifetime} onChange={(event) => setLifetime(event.target.value)}>
            <option value="3600">1 hora</option>
            <option value="86400">24 horas</option>
            <option value="604800">7 días</option>
            <option value="2592000">30 días</option>
          </select>
        </label>
        <TextField label="Contraseña (opcional)" type="password" autoComplete="new-password" minLength={8} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} hint="Si la defines, el destinatario deberá introducirla para descargar." />
        <Button icon="plus" loading={loading} disabled={Boolean(password) && password.length < 8} onClick={() => void create()}>Crear enlace de lectura</Button>
        {createdLink ? <div className="vd-share__created">
          <label className="vd-field__label" htmlFor="vd-share-link">Enlace creado</label>
          <input id="vd-share-link" className="vd-field__input" readOnly value={createdLink} onFocus={(event) => event.currentTarget.select()} />
          <Button variant="secondary" icon="file" onClick={() => void copyLink()}>Copiar enlace</Button>
        </div> : null}
        {error ? <p className="vd-catalog__form-error" role="alert">{error}</p> : null}
        <div className="vd-share__list">
          <h3>Enlaces de este archivo</h3>
          {shares.length === 0 ? <p className="vd-share__empty">Todavía no hay enlaces creados.</p> : shares.map((share) => {
            const expired = new Date(share.expiresAt).getTime() <= Date.now();
            const disabled = Boolean(share.revokedAt) || expired;
            return <div className="vd-share__entry" key={share.id}>
              <div><strong>{disabled ? (share.revokedAt ? "Revocado" : "Vencido") : "Activo"}{share.passwordProtected ? " · Con contraseña" : " · Sin contraseña"}</strong><span>Vence: {dateLabel(share.expiresAt)}</span></div>
              {!disabled ? <Button size="sm" variant="danger" onClick={() => void revoke(share.id)}>Revocar</Button> : null}
            </div>;
          })}
        </div>
      </div>
    </Modal>
  );
}
