import { routeMeta } from "./router/route-meta";
import { useRoute } from "./router/use-route";
import { AuthLayout } from "./screens/AuthLayout";
import { renderScreen } from "./screens/screen-for-route";
import { AppShell } from "./shell/AppShell";
import { ServicesProvider } from "./services/services-context";
import type { Services } from "./services/services";
import { ThemeProvider } from "./theme/ThemeProvider";
import { ToastProvider } from "./ui/ToastProvider";

function Routes() {
  const route = useRoute();
  if (routeMeta(route).layout === "auth") return <AuthLayout route={route} />;
  return <AppShell route={route}>{renderScreen(route)}</AppShell>;
}

/** Raiz de la aplicacion. Los servicios llegan inyectados desde main.tsx. */
export function App({ services }: { services: Services }) {
  return (
    <ThemeProvider>
      <ServicesProvider services={services}>
        <ToastProvider>
          <Routes />
        </ToastProvider>
      </ServicesProvider>
    </ThemeProvider>
  );
}
