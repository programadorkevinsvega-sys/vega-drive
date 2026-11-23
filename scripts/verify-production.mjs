import process from "node:process";

const baseUrl = (process.env.PRODUCTION_URL ?? "https://drive.jnmtortas.com").replace(/\/$/, "");
const timeoutMs = Number(process.env.HEALTH_TIMEOUT_MS ?? "15000");
const retries = Number(process.env.HEALTH_RETRIES ?? "12");
const retryDelayMs = Number(process.env.HEALTH_RETRY_DELAY_MS ?? "5000");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function request(path) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(baseUrl + path, {
      signal: controller.signal,
      headers: { accept: path === "/" ? "text/html" : "application/json" },
      redirect: "manual",
    });
  } finally {
    clearTimeout(timer);
  }
}

function verifySecurityHeaders(response, label, api = false) {
  const required = [
    ["x-content-type-options", "nosniff"],
    ["referrer-policy", "strict-origin-when-cross-origin"],
    ["x-frame-options", "SAMEORIGIN"],
    ["strict-transport-security", "max-age=31536000"],
    ["permissions-policy", "camera=()"],
    ["cross-origin-opener-policy", "same-origin"],
    ["cross-origin-resource-policy", "same-origin"],
  ];
  const failures = [];
  for (const [name, expected] of required) {
    if (!(response.headers.get(name) ?? "").includes(expected)) {
      failures.push(name + " missing or unexpected");
    }
  }
  const csp = response.headers.get("content-security-policy") ?? "";
  for (const directive of ["default-src 'self'", "object-src 'none'", "frame-ancestors 'self'"]) {
    if (!csp.includes(directive)) failures.push("CSP missing " + directive);
  }
  if (/unsafe-inline|unsafe-eval/.test(csp)) failures.push("CSP contains an unsafe-inline/unsafe-eval exception");
  if (api && response.headers.get("cache-control") !== "no-store") failures.push("API response is not Cache-Control: no-store");
  if (failures.length) throw new Error(label + " security headers failed: " + failures.join("; "));
  console.log("PASS " + label + ": required security headers" + (api ? " and no-store" : ""));
}

async function verifyHealth() {
  let lastError;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const response = await request("/api/health");
      const bodyText = await response.text();
      let body;
      try { body = JSON.parse(bodyText); } catch { body = null; }
      if (response.status !== 200 || body?.status !== "ok" || body?.service !== "vega-drive") {
        throw new Error("Expected HTTP 200 and status=ok/service=vega-drive; received HTTP " + response.status + ", body=" + bodyText.slice(0, 300));
      }
      verifySecurityHeaders(response, "/api/health", true);
      return;
    } catch (error) {
      lastError = error;
    }
    if (attempt < retries) {
      console.warn("Health attempt " + attempt + "/" + retries + " failed; retrying in " + retryDelayMs + "ms.");
      await sleep(retryDelayMs);
    }
  }
  throw lastError ?? new Error("Production health verification failed.");
}

async function verifyFrontend() {
  const response = await request("/");
  const contentType = response.headers.get("content-type") ?? "";
  if (response.status !== 200 || !contentType.includes("text/html")) {
    throw new Error("Production frontend failed: expected HTML HTTP 200; received HTTP " + response.status + ", content-type=" + contentType);
  }
  verifySecurityHeaders(response, "/");
}

async function verifyAuthConfiguration() {
  const response = await request("/api/auth/config");
  const bodyText = await response.text();
  let body;
  try { body = JSON.parse(bodyText); } catch { body = null; }
  const siteKeyPresent = typeof body?.turnstileSiteKey === "string" && body.turnstileSiteKey.trim().length > 0;
  if (response.status !== 200 || body?.ready !== true || !siteKeyPresent) {
    throw new Error("Production authentication configuration is not ready: expected HTTP 200, ready=true and a public site key; received HTTP " + response.status + ", ready=" + String(body?.ready) + ", siteKeyPresent=" + siteKeyPresent + ". Verify TURNSTILE_SITE_KEY, TURNSTILE_SECRET_KEY and TURNSTILE_HOSTNAMES.");
  }
  verifySecurityHeaders(response, "/api/auth/config", true);
}

if (!process.argv.includes("--auth-config-only")) {
  await verifyFrontend();
  await verifyHealth();
}
await verifyAuthConfiguration();
console.log("Production verification passed for " + baseUrl);
