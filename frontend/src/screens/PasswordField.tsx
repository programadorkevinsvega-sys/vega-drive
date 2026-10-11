import { useEffect, useState } from "react";
import type { PasswordChangeField } from "./password-change-validation";
import { TextField } from "../ui/TextField";

interface PasswordFieldProps {
  label: string;
  name: PasswordChangeField;
  value: string;
  autoComplete: "current-password" | "new-password";
  onChange(value: string): void;
  loading: boolean;
  showLabel: string;
  hideLabel: string;
  error: string | undefined;
  hint: string | undefined;
}

export function PasswordField({
  label,
  name,
  value,
  autoComplete,
  onChange,
  loading,
  showLabel,
  hideLabel,
  error,
  hint,
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!loading) setVisible(false);
  }, [loading]);

  return (
    <TextField
      label={label}
      name={name}
      type={visible ? "text" : "password"}
      autoComplete={autoComplete}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      required
      maxLength={128}
      disabled={loading}
      {...(error ? { error } : {})}
      {...(hint ? { hint } : {})}
      trailing={
        <button
          type="button"
          className="vd-auth__password-toggle"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? hideLabel : showLabel}
          aria-pressed={visible}
          disabled={loading}
        >
          {visible ? "Ocultar" : "Mostrar"}
        </button>
      }
    />
  );
}
