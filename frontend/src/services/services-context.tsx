import { createContext, useContext, type ReactNode } from "react";
import type { Services } from "./services";

const ServicesContext = createContext<Services | null>(null);

export interface ServicesProviderProps {
  services: Services;
  children: ReactNode;
}

export function ServicesProvider({ services, children }: ServicesProviderProps) {
  return (
    <ServicesContext.Provider value={services}>
      {children}
    </ServicesContext.Provider>
  );
}

export function useServices(): Services {
  const services = useContext(ServicesContext);
  if (!services) throw new Error("Falta ServicesProvider en el arbol.");
  return services;
}
