import { cx } from "../lib/cx";

export interface SpinnerProps {
  size?: "sm" | "md";
  /** Si se indica, se anuncia a lectores de pantalla; si no, es decorativo. */
  label?: string;
}

export function Spinner({ size = "md", label }: SpinnerProps) {
  return (
    <span
      className={cx("vd-spinner", `vd-spinner--${size}`)}
      role={label ? "status" : undefined}
      aria-hidden={label ? undefined : true}
    >
      {label ? <span className="vd-sr-only">{label}</span> : null}
    </span>
  );
}
