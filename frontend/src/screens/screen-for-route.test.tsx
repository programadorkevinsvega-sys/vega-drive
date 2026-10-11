import { describe, expect, it } from "vitest";
import { PasswordSettingsScreen } from "./PasswordSettingsScreen";
import { renderScreen } from "./screen-for-route";

describe("pantalla de ajustes", () => {
  it("usa el formulario real de seguridad de la cuenta", () => {
    expect(renderScreen({ name: "settings" })).toMatchObject({
      type: PasswordSettingsScreen,
    });
  });
});
