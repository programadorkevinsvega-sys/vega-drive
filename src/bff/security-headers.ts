export const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "DENY",
  "Content-Security-Policy": [
    "default-src 'self'; object-src 'none'; base-uri 'self';",
    "frame-ancestors 'none'",
  ].join(" "),
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
} as const;
