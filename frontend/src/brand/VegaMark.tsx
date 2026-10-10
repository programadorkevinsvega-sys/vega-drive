export interface VegaMarkProps {
  className?: string | undefined;
}

/**
 * Simbolo de Vega Drive: una "V" de dos trazos y una estrella de cuatro
 * puntas (Vega, la estrella de Lyra) en su apertura. El trazo usa
 * currentColor; la estrella usa --vd-mark-star.
 */
export function VegaMark({ className }: VegaMarkProps) {
  return (
    <svg
      className={className ? `vd-mark ${className}` : "vd-mark"}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M8 9.5 16 24l8-14.5"
        stroke="currentColor"
        strokeWidth="3.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        className="vd-mark__star"
        d="M16 4.2 17.2 7.6 20.6 8.8 17.2 10 16 13.4 14.8 10 11.4 8.8 14.8 7.6Z"
      />
    </svg>
  );
}
