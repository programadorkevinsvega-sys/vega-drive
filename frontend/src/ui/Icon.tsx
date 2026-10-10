import { cx } from "../lib/cx";
import { iconPath, type IconName } from "./icon-paths";

export type IconSize = "sm" | "md" | "lg";

export interface IconProps {
  name: IconName;
  size?: IconSize;
  className?: string | undefined;
}

/** Icono decorativo (aria-hidden). El nombre accesible lo da el contenedor. */
export function Icon({ name, size = "md", className }: IconProps) {
  return (
    <svg
      className={cx("vd-icon", `vd-icon--${size}`, className)}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {iconPath(name)}
    </svg>
  );
}

export type { IconName };
