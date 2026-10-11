import process from "node:process";

const baseUrl = (
  process.env.PRODUCTION_URL ??
  "https://vega-drive.programadorkevinsvega.workers.dev"
).replace(/\/$/, "");
const timeoutMs = Number(process.env.HEALTH_TIMEOUT_MS ?? "15000");
const retries = Number(process.env.HEALTH_RETRIES ?? "12");
const retryDelayMs = Number(process.env.HEALTH_RETRY_DELAY_MS ?? "5000");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function verifyHealth() {
  let lastError;

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${baseUrl}/api/health`, {
        signal: controller.signal,
        headers: { accept: "application/json" },
      });
      const bodyText = await response.text();
      let body;

      try {
        body = JSON.parse(bodyText);
      } catch {
        body = null;
      }

      if (
        response.status === 200 &&
        body?.status === "ok" &&
        body?.service === "vega-drive"
      ) {
        console.log(
          `PASS /api/health: HTTP ${response.status}, status=${body.status}, service=${body.service}`,
        );
        return;
      }

      lastError = new Error(
        `Expected HTTP 200 and status=ok/service=vega-drive; received HTTP ${response.status}, body=${bodyText.slice(0, 300)}`,
      );
    } catch (error) {
      lastError = error;
    } finally {
      clearTimeout(timer);
    }

    if (attempt < retries) {
      console.warn(
        `Health check attempt ${attempt}/${retries} failed; retrying in ${retryDelayMs}ms.`,
      );
      await sleep(retryDelayMs);
    }
  }

  throw lastError ?? new Error("Production health verification failed.");
}

async function verifyAuthConfiguration() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${baseUrl}/api/auth/config`, {
      signal: controller.signal,
      headers: { accept: "application/json" },
    });
    const bodyText = await response.text();
    let body;

    try {
      body = JSON.parse(bodyText);
    } catch {
      body = null;
    }

    const siteKeyPresent =
      typeof body?.turnstileSiteKey === "string" &&
      body.turnstileSiteKey.trim().length > 0;
    if (response.status === 200 && body?.ready === true && siteKeyPresent) {
      console.log(
        "PASS /api/auth/config: public site key present and server-side secret configured",
      );
      return;
    }

    throw new Error(
      `Production authentication configuration is not ready: expected HTTP 200, ready=true and a public site key; received HTTP ${response.status}, ready=${String(body?.ready)}, siteKeyPresent=${siteKeyPresent}. Verify TURNSTILE_SITE_KEY, the TURNSTILE_SECRET_KEY Worker secret, and TURNSTILE_HOSTNAMES.`,
    );
  } finally {
    clearTimeout(timer);
  }
}

if (!process.argv.includes("--auth-config-only")) {
  await verifyHealth();
}
await verifyAuthConfiguration();
if (!process.argv.includes("--auth-config-only")) {
  console.log(`Production verification passed for ${baseUrl}`);
}
