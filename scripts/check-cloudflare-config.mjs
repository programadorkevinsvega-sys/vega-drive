import { readFile } from "node:fs/promises";
import process from "node:process";

const configPath =
  process.env.VEGA_DRIVE_WRANGLER_CONFIG ??
  new URL("../wrangler.toml", import.meta.url);
const config = await readFile(configPath, "utf8");
const databaseId = config.match(/^database_id\s*=\s*"([^"]+)"/m)?.[1];
const bucketName = config.match(/^bucket_name\s*=\s*"([^"]+)"/m)?.[1];
const turnstileSiteKey = config.match(
  /^TURNSTILE_SITE_KEY\s*=\s*"([^"]+)"/m,
)?.[1];
const turnstileHostnames = (
  config.match(/^TURNSTILE_HOSTNAMES\s*=\s*"([^"]+)"/m)?.[1] ?? ""
)
  .split(",")
  .map((hostname) => hostname.trim().toLowerCase())
  .filter(Boolean);
const failures = [];

if (!databaseId || /^0{8}-0{4}-0{4}-0{4}-0{12}$/.test(databaseId)) {
  failures.push(
    "VEGA_DRIVE_DB todavía tiene un database_id marcador; crea D1 y configura su ID real.",
  );
}
if (!bucketName || bucketName === "replace-me") {
  failures.push("Configura el nombre real del bucket R2 en wrangler.toml.");
}
if (!turnstileSiteKey) {
  failures.push("Configura TURNSTILE_SITE_KEY en wrangler.toml.");
}
if (turnstileHostnames.length === 0) {
  failures.push("Configura TURNSTILE_HOSTNAMES en wrangler.toml.");
}
if (
  turnstileHostnames.some((hostname) =>
    ["localhost", "127.0.0.1", "::1"].includes(hostname),
  )
) {
  failures.push(
    "TURNSTILE_HOSTNAMES de producción no debe incluir hostnames locales.",
  );
}

if (failures.length) {
  console.error("No se puede desplegar Vega Drive:");
  for (const failure of failures) console.error(" - " + failure);
  process.exitCode = 1;
} else {
  console.log(
    "Configuración Cloudflare local lista para intentar el despliegue.",
  );
}
