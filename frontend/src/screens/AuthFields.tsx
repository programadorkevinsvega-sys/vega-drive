import type { Dispatch, SetStateAction } from "react";
import { TextField } from "../ui/TextField";

interface AuthFieldsProps {
  isLogin: boolean;
  email: string;
  setEmail: Dispatch<SetStateAction<string>>;
  password: string;
  setPassword: Dispatch<SetStateAction<string>>;
  loading: boolean;
  showPassword: boolean;
  setShowPassword: Dispatch<SetStateAction<boolean>>;
}

export function AuthFields({
  isLogin,
  email,
  setEmail,
  password,
  setPassword,
  loading,
  showPassword,
  setShowPassword,
}: AuthFieldsProps) {
  return (
    <>
      <TextField
        label="Correo electrónico"
        name="email"
        type="email"
        autoComplete="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        required
        maxLength={254}
        disabled={loading}
      />
      <TextField
        label="Contraseña"
        name="password"
        type={showPassword ? "text" : "password"}
        autoComplete={isLogin ? "current-password" : "new-password"}
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        required
        minLength={12}
        maxLength={128}
        {...(!isLogin
          ? {
              hint: "Usa entre 12 y 128 caracteres. Evita contraseñas comunes.",
            }
          : {})}
        disabled={loading}
        trailing={
          <button
            type="button"
            className="vd-auth__password-toggle"
            onClick={() => setShowPassword((value) => !value)}
            aria-label={
              showPassword ? "Ocultar contraseña" : "Mostrar contraseña"
            }
            aria-pressed={showPassword}
            disabled={loading}
          >
            {showPassword ? "Ocultar" : "Mostrar"}
          </button>
        }
      />
    </>
  );
}
