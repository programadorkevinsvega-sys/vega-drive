import { describe, expect, it } from "vitest";
import { PasswordSettingsScreen } from "./PasswordSettingsScreen";
import { FilesCatalogScreen } from "./FilesCatalogScreen";
import { FavoritesScreen } from "./FavoritesScreen";
import { ShareAccessScreen } from "./ShareAccessScreen";
import { renderScreen } from "./screen-for-route";

describe("pantallas conectadas al Worker", () => {
  it("usa el catálogo HTTP real para Mi unidad y sus carpetas", () => {
    expect(renderScreen({ name: "drive", folderId: null })).toMatchObject({
      type: FilesCatalogScreen,
      props: { view: "drive", folderId: null },
    });
    expect(
      renderScreen({ name: "drive", folderId: "folder-123" }),
    ).toMatchObject({
      type: FilesCatalogScreen,
      props: { view: "drive", folderId: "folder-123" },
    });
  });

  it("usa el catálogo HTTP real para la papelera", () => {
    expect(renderScreen({ name: "trash" })).toMatchObject({
      type: FilesCatalogScreen,
      props: { view: "trash", folderId: null },
    });
  });
});

describe("pantalla de favoritos", () => {
  it("conecta Favoritos a la pantalla real", () => {
    expect(renderScreen({ name: "favorites" })).toMatchObject({
      type: FavoritesScreen,
    });
  });
});

describe("pantalla pública de compartición", () => {
  it("muestra la pantalla pública para el token del enlace", () => {
    expect(renderScreen({ name: "share", token: "a".repeat(43) })).toMatchObject({ type: ShareAccessScreen, props: { token: "a".repeat(43) } });
  });
});

describe("pantalla de ajustes", () => {
  it("usa el formulario real de seguridad de la cuenta", () => {
    expect(renderScreen({ name: "settings" })).toMatchObject({
      type: PasswordSettingsScreen,
    });
  });
});
