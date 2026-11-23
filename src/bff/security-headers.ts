export const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  // Same-origin framing is required by the authenticated PDF preview iframe.
  "X-Frame-Options": "SAMEORIGIN",
  "Content-Security-Policy": [
    "default-src 'self';",
    "script-src 'self' https://challenges.cloudflare.com;",
    "style-src 'self';",
    "img-src 'self' data: blob:;",
    "font-src 'self' data:;",
    "connect-src 'self' https://challenges.cloudflare.com;",
    "media-src 'self' blob:;",
    "frame-src 'self' https://challenges.cloudflare.com;",
    "object-src 'none';",
    "base-uri 'self';",
    "form-action 'self';",
    "frame-ancestors 'self'",
  ].join(" "),
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "Permissions-Policy":
    "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
  "X-DNS-Prefetch-Control": "off",
  "X-Permitted-Cross-Domain-Policies": "none",
} as const;
