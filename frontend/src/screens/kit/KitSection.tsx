import { useId, type ReactNode } from "react";

export interface KitSectionProps {
  title: string;
  description?: string;
  children: ReactNode;
}

export function KitSection({ title, description, children }: KitSectionProps) {
  const id = useId();
  return (
    <section className="vd-kit__section" aria-labelledby={id}>
      <div>
        <h2 id={id} className="vd-kit__heading">
          {title}
        </h2>
        {description ? <p className="vd-kit__desc">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}
