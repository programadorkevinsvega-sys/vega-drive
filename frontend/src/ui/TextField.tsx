import { useId, type InputHTMLAttributes, type ReactNode } from "react";
import { cx } from "../lib/cx";
import { Icon } from "./Icon";

export interface TextFieldProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "id"
> {
  label: string;
  hint?: string;
  /** Mensaje de validacion visible; marca el campo como invalido. */
  error?: string;
  /** Contenido a la derecha del campo (p. ej. un boton mostrar/ocultar). */
  trailing?: ReactNode;
}

export function TextField({
  label,
  hint,
  error,
  trailing,
  className,
  required,
  ...rest
}: TextFieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy =
    [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") ||
    undefined;

  return (
    <div className={cx("vd-field", error && "vd-field--invalid", className)}>
      <label className="vd-field__label" htmlFor={id}>
        {label}
        {required ? <span aria-hidden="true"> *</span> : null}
      </label>
      <div className="vd-field__control">
        <input
          {...rest}
          id={id}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cx(
            "vd-field__input",
            trailing ? "vd-field__input--pad" : null,
          )}
        />
        {trailing ? <div className="vd-field__trailing">{trailing}</div> : null}
      </div>
      {hint ? (
        <p id={hintId} className="vd-field__hint">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="vd-field__error">
          <Icon name="alert" size="sm" />
          {error}
        </p>
      ) : null}
    </div>
  );
}
