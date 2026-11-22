import { useEffect, useState } from "react";
import type { UserProfile } from "../domain/user";
import { useServices } from "./services-context";

export type AsyncState<T> =
  { status: "loading" } | { status: "ready"; data: T } | { status: "error" };

/** Carga el perfil actual. El error no expone detalles al usuario. */
export function useProfile(): AsyncState<UserProfile> {
  const { profile } = useServices();
  const [state, setState] = useState<AsyncState<UserProfile>>({
    status: "loading",
  });

  useEffect(() => {
    let cancelled = false;
    profile.getCurrentProfile().then(
      (data) => {
        if (!cancelled) setState({ status: "ready", data });
      },
      () => {
        if (!cancelled) setState({ status: "error" });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [profile]);

  return state;
}
