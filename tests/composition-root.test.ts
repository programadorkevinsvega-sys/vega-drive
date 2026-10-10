import { describe, expect, it } from "vitest";
import { createCompositionRoot } from "../src/bff/composition-root.js";
import type { Env } from "../src/worker/env.js";

describe("composition root", () => {
  it("exposes all module APIs through in-process gateways", () => {
    const gateways = createCompositionRoot({} as Env);

    expect(gateways.identity.status()).toEqual({
      module: "identity",
      ready: false,
    });
    expect(gateways.files.status()).toEqual({
      module: "files",
      ready: false,
    });
    expect(gateways.quota.status()).toEqual({
      module: "quota",
      ready: false,
    });
    expect(gateways.sharing.status()).toEqual({
      module: "sharing",
      ready: false,
    });
  });
});
