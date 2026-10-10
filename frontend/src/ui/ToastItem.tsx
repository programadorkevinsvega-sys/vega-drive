import { useEffect, useState } from "react";
import { cx } from "../lib/cx";
import { Icon, type IconName } from "./Icon";
import { IconButton } from "./IconButton";
import { SimulatedBadge } from "./Badge";
import type { Toast, ToastTone } from "./toast-store";

const TONE_ICON: Record<ToastTone, IconName> = {
  info: "info",
  success: "check",
  error: "alert",
};

const DURATION_MS: Record<ToastTone, number> = {
  info: 6000,
  success: 6000,
  error: 10000,
};

export interface ToastItemProps {
  toast: Toast;
  onDismiss: (id: number) => void;
}

/** Se cierra solo; se pausa con el puntero o el foco encima. */
export function ToastItem({ toast, onDismiss }: ToastItemProps) {
  const [paused, setPaused] = useState(false);
  const { id, tone } = toast;

  useEffect(() => {
    if (paused) return;
    const timer = window.setTimeout(() => onDismiss(id), DURATION_MS[tone]);
    return () => window.clearTimeout(timer);
  }, [paused, id, tone, onDismiss]);

  return (
    <div
      className={cx("vd-toast", `vd-toast--${tone}`)}
      role={tone === "error" ? "alert" : "status"}
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <Icon name={TONE_ICON[tone]} className="vd-toast__icon" />
      <div className="vd-toast__body">
        {toast.simulated ? (
          <div className="vd-toast__kicker">
            <SimulatedBadge />
          </div>
        ) : null}
        <p className="vd-toast__title">{toast.title}</p>
        {toast.description ? (
          <p className="vd-toast__desc">{toast.description}</p>
        ) : null}
      </div>
      <IconButton
        label="Cerrar notificación"
        icon="close"
        size="sm"
        onClick={() => onDismiss(id)}
      />
    </div>
  );
}
