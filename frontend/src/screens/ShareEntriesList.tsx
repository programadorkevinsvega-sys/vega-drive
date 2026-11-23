import { Button } from "../ui/Button";
import type { ShareEntry } from "../services/files-sharing-service";

interface ShareEntriesListProps {
  shares: ShareEntry[];
  onRevoke: (id: string) => void;
}

function dateLabel(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Fecha no disponible"
    : new Intl.DateTimeFormat("es-CO", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
}

export function ShareEntriesList({ shares, onRevoke }: ShareEntriesListProps) {
  return (
    <div className="vd-share__list">
      <h3>Enlaces de este archivo</h3>
      {shares.length === 0 ? (
        <p className="vd-share__empty">Todavía no hay enlaces creados.</p>
      ) : (
        shares.map((share) => {
          const expired = new Date(share.expiresAt).getTime() <= Date.now();
          const disabled = Boolean(share.revokedAt) || expired;
          return (
            <div className="vd-share__entry" key={share.id}>
              <div>
                <strong>
                  {disabled
                    ? share.revokedAt
                      ? "Revocado"
                      : "Vencido"
                    : "Activo"}
                  {share.passwordProtected
                    ? " · Con contraseña"
                    : " · Sin contraseña"}
                </strong>
                <span>Vence: {dateLabel(share.expiresAt)}</span>
              </div>
              {!disabled ? (
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => onRevoke(share.id)}
                >
                  Revocar
                </Button>
              ) : null}
            </div>
          );
        })
      )}
    </div>
  );
}
