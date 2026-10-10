import type { ReactNode } from "react";
import { cx } from "../lib/cx";

export type BadgeTone = "neutral" | "accent" | "success" | "warning" | "danger";

export interface BadgeProps {
  tone?: BadgeTone;
  children: ReactNode;
}

export function Badge({ tone = "neutral", children }: BadgeProps) {
  return <span className={cx("vd-badge", `vd-badge--${tone}`)}>{children}</span>;
}

/** Marca de todo lo que NO es real: acciones y datos de demostracion. */
export function SimulatedBadge() {
  return <Badge tone="warning">Simulado</Badge>;
}
