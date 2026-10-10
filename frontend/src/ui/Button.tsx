import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cx } from "../lib/cx";
import { Icon, type IconName } from "./Icon";
import { Spinner } from "./Spinner";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Muestra un indicador y bloquea los clics sin perder el foco. */
  loading?: boolean;
  icon?: IconName;
  fullWidth?: boolean;
  children: ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  icon,
  fullWidth = false,
  type = "button",
  className,
  onClick,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      type={type}
      aria-busy={loading || undefined}
      aria-disabled={loading || undefined}
      className={cx(
        "vd-btn",
        `vd-btn--${variant}`,
        `vd-btn--${size}`,
        fullWidth && "vd-btn--block",
        loading && "vd-btn--loading",
        className,
      )}
      onClick={(event) => {
        if (loading) {
          event.preventDefault();
          return;
        }
        onClick?.(event);
      }}
    >
      {loading ? (
        <Spinner size="sm" />
      ) : icon ? (
        <Icon name={icon} size="sm" />
      ) : null}
      {children}
    </button>
  );
}
