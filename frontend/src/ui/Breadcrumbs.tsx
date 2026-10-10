import { Icon } from "./Icon";

export interface Crumb {
  label: string;
  /** Sin href = elemento actual (no es un enlace). */
  href?: string;
}

export function Breadcrumbs({ items }: { items: readonly Crumb[] }) {
  return (
    <nav className="vd-crumbs" aria-label="Ruta de navegación">
      <ol className="vd-crumbs__list">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li className="vd-crumbs__item" key={`${index}-${item.label}`}>
              {item.href && !isLast ? (
                <a href={item.href}>{item.label}</a>
              ) : (
                <span aria-current={isLast ? "page" : undefined}>
                  {item.label}
                </span>
              )}
              {isLast ? null : <Icon name="chevron-right" size="sm" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
