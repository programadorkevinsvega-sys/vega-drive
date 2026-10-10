export function resolveD1Target(args) {
  if (args.some((argument) => argument !== "--local" && argument !== "--remote")) {
    throw new Error("Usage: verify-d1-schema.mjs [--local|--remote]");
  }
  if (args.includes("--local") && args.includes("--remote")) {
    throw new Error("Choose only one D1 target: --local or --remote.");
  }
  return args.includes("--local") ? "local" : "remote";
}

export function buildWranglerD1ExecuteArgs({ wranglerCommand, databaseName, target }) {
  const commandPrefix =
    wranglerCommand === "pnpm"
      ? ["exec", "wrangler", "d1", "execute"]
      : ["d1", "execute"];
  const targetFlag = target === "local" ? "--local" : "--remote";
  return [...commandPrefix, databaseName, targetFlag, "--json"];
}
