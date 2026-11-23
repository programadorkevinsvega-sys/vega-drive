import { useEffect } from "react";
import { routeMeta } from "./router/route-meta";
import { navigate, useRoute } from "./router/use-route";
import { AuthLayout } from "./screens/AuthLayout";
import { renderScreen } from "./screens/screen-for-route";
import { AppShell } from "./shell/AppShell";
import { ServicesProvider } from "./services/services-context";
import type { Services } from "./services/services";
import { AuthProvider, useAuth } from "./services/auth-context";
import { ThemeProvider } from "./theme/ThemeProvider";
import { ToastProvider } from "./ui/ToastProvider";

function Routes() {
  const route = useRoute();
  const auth = useAuth();
  const layout = routeMeta(route).layout;\n  const isAuthRoute = layout === "auth";\n  const isPublicRoute = layout === "public";
  useEffect(() => {
    if (
      !isAuthRoute &&\n      !isPublicRoute &&
      (auth.status === "anonymous" || auth.status === "unavailable")
    ) {
      navigate({ name: "login" });
    } else if (isAuthRoute && auth.status === "authenticated") {
      navigate({ name: "drive", folderId: null });
    }
  }, [auth.status, isAuthRoute, isPublicRoute]);

  if (isAuthRoute) return <AuthLayout route={route} />;\n  if (isPublicRoute) return renderScreen(route);
  if (auth.status === "loading")
    return (
      <div className="vd-auth__loading" role="status">
        Comprobando sesión…
      </div>
    );
  if (auth.status !== "authenticated")
    return <AuthLayout route={{ name: "login" }} />;
  return <AppShell route={route}>{renderScreen(route)}</AppShell>;
}

export function App({ services }: { services: Services }) {
  return (
    <ThemeProvider>
      <ServicesProvider services={services}>
        <AuthProvider>
          <ToastProvider>
            <Routes />
          </ToastProvider>
        </AuthProvider>
      </ServicesProvider>
    </ThemeProvider>
  );
}
