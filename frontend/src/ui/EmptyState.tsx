import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

export interface EmptyStateProps {
  icon: IconName;
  title: string;
  description?: string;
  action?: ReactNode;
  headingLevel?: 2 | 3;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  headingLevel = 2,
}: EmptyStateProps) {
  const Heading = headingLevel === 3 ? "h3" : "h2";
  return (
    <div className="vd-empty">
      <span className="vd-empty__icon">
        <Icon name={icon} size="lg" />
      </span>
      <Heading className="vd-empty__title">{title}</Heading>
      {description ? <p className="vd-empty__text">{description}</p> : null}
      {action ? <div className="vd-empty__action">{action}</div> : null}
    </div>
  );
}
