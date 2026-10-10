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
        console.log(`Production verification passed for ${baseUrl}`);
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

await verifyHealth();
