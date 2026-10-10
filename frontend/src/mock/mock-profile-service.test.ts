import { describe, expect, it } from "vitest";
import { createMockProfileService } from "./mock-profile-service";
import { createMockServices } from "./mock-services";

describe("servicios simulados", () => {
  it("el perfil es ficticio y usa un dominio reservado", async () => {
    const profile = await createMockProfileService(0).getCurrentProfile();
    expect(profile.displayName).toBe("Perfil de ejemplo");
    expect(profile.email.endsWith(".invalid")).toBe(true);
  });

  it("el conjunto de servicios declara el modo simulado", () => {
    expect(createMockServices().mode).toBe("mock");
  });
});
