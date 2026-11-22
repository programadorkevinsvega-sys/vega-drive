import type { ButtonHTMLAttributes } from "react";
import { cx } from "../lib/cx";
import { Icon, type IconName } from "./Icon";

export type IconButtonVariant = "ghost" | "secondary";
export type IconButtonSize = "sm" | "md";

export function iconButtonClass(
  variant: IconButtonVariant = "ghost",
  size: IconButtonSize = "md",
): string {
  return cx("vd-iconbtn", `vd-iconbtn--${variant}`, `vd-iconbtn--${size}`);
}

export interface IconButtonProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "children"
> {
  /** Obligatorio: nombre accesible (tambien se usa como tooltip nativo). */
  label: string;
  icon: IconName;
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  pressed?: boolean;
}

export function IconButton({
  label,
  icon,
  variant = "ghost",
  size = "md",
  pressed,
  type = "button",
  className,
  ...rest
}: IconButtonProps) {
  return (
    <button
      {...rest}
      type={type}
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      className={cx(iconButtonClass(variant, size), className)}
    >
      <Icon name={icon} size={size === "sm" ? "sm" : "md"} />
    </button>
  );
}
