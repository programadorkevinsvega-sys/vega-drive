import { readFile } from "node:fs/promises";
import process from "node:process";

const config = await readFile(new URL("../wrangler.toml", import.meta.url), "utf8");
const databaseId = config.match(/^database_id\s*=\s*"([^"]+)"/m)?.[1];
const bucketName = config.match(/^bucket_name\s*=\s*"([^"]+)"/m)?.[1];
const failures = [];

if (!databaseId || /^0{8}-0{4}-0{4}-0{4}-0{12}$/.test(databaseId)) {
  failures.push("VEGA_DRIVE_DB todavía tiene un database_id marcador; crea D1 y configura su ID real.");
}
if (!bucketName || bucketName === "replace-me") {
  failures.push("Configura el nombre real del bucket R2 en wrangler.toml.");
}

if (failures.length) {
  console.error("No se puede desplegar Vega Drive:");
  for (const failure of failures) console.error(" - " + failure);
  process.exitCode = 1;
} else {
  console.log("Configuración Cloudflare local lista para intentar el despliegue.");
}
