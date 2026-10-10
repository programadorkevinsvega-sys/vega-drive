import { Breadcrumbs, type Crumb } from "../ui/Breadcrumbs";
import { EmptyState } from "../ui/EmptyState";
import type { IconName } from "../ui/Icon";

export interface ScreenPlaceholderProps {
  icon: IconName;
  title: string;
  crumbs: readonly Crumb[];
  /** Entrega del plan en la que se construye esta pantalla. */
  delivery: string;
  description: string;
}

/** Marcador honesto: la pantalla existe en la navegacion pero aun no esta hecha. */
export function ScreenPlaceholder({
  icon,
  title,
  crumbs,
  delivery,
  description,
}: ScreenPlaceholderProps) {
  return (
    <div className="vd-page">
      <Breadcrumbs items={crumbs} />
      <h1 className="vd-page__title">{title}</h1>
      <section className="vd-panel" aria-label={`${title}: en preparación`}>
        <EmptyState
          icon={icon}
          title={`Pantalla en preparación · ${delivery}`}
          description={description}
        />
      </section>
    </div>
  );
}
