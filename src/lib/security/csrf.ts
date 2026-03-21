import { NextResponse } from "next/server";

/**
 * CSRF protection for local API routes.
 *
 * Since OhMyDashboard runs locally, any website the user visits in their
 * browser can potentially make requests to localhost:3000. This middleware
 * protects against that by checking the Origin/Referer header.
 *
 * For state-changing requests (POST, PATCH, DELETE), we require:
 * 1. The request comes from the same origin (Origin or Referer header matches), OR
 * 2. The request includes our custom header (X-OMD-Request: 1), which browsers
 *    won't send cross-origin without a CORS preflight we don't allow.
 */

const CUSTOM_HEADER = "x-omd-request";
const CUSTOM_HEADER_VALUE = "1";

/**
 * Validate that a request is not a CSRF attack.
 * Returns null if valid, or a NextResponse error if invalid.
 */
export function validateCsrf(request: Request): NextResponse | null {
  const method = request.method.toUpperCase();

  // Safe methods don't need CSRF protection
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return null;
  }

  // Check custom header first (simplest and strongest protection)
  const customHeader = request.headers.get(CUSTOM_HEADER);
  if (customHeader === CUSTOM_HEADER_VALUE) {
    return null;
  }

  // Get allowed hostnames from environment variable (comma-separated for multiple domains)
  // Format: "localhost,127.0.0.1,your-app.vercel.app,your-domain.com"
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || "localhost,127.0.0.1")
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);

  // Debug log in development
  if (process.env.NODE_ENV === "development") {
    console.log("[CSRF] Request:", method, request.url);
    console.log("[CSRF] Custom header:", customHeader);
    console.log("[CSRF] Allowed origins:", allowedOrigins);
  }

  // Check Origin header
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      const originUrl = new URL(origin);
      const originHostname = originUrl.hostname.toLowerCase();
      if (allowedOrigins.includes(originHostname)) {
        return null;
      }
      // Debug log for rejected origins
      console.log("[CSRF] Rejected origin:", origin, "not in", allowedOrigins);
    } catch {
      // Invalid origin URL, reject
      console.log("[CSRF] Invalid origin format:", origin);
    }

    return NextResponse.json(
      { error: "Forbidden: cross-origin request blocked", origin, allowedOrigins },
      { status: 403 }
    );
  }

  // Check Referer as fallback
  const referer = request.headers.get("referer");
  if (referer) {
    try {
      const refererUrl = new URL(referer);
      const refererHostname = refererUrl.hostname.toLowerCase();
      if (allowedOrigins.includes(refererHostname)) {
        return null;
      }
      console.log("[CSRF] Rejected referer:", referer, "not in", allowedOrigins);
    } catch {
      // Invalid referer URL, reject
      console.log("[CSRF] Invalid referer format:", referer);
    }

    return NextResponse.json(
      { error: "Forbidden: cross-origin request blocked", referer, allowedOrigins },
      { status: 403 }
    );
  }

  // No Origin or Referer header at all
  console.log("[CSRF] No origin or referer, custom header was:", customHeader);
  return NextResponse.json(
    { error: "Forbidden: missing origin verification. Include the x-omd-request header." },
    { status: 403 }
  );
}

/**
 * Get the custom CSRF header name and value.
 * The client should include this in all state-changing requests.
 */
export const CSRF_HEADER = {
  name: CUSTOM_HEADER,
  value: CUSTOM_HEADER_VALUE,
} as const;
