import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { evaluateAccess } from "@/lib/auth";
import { checkRateLimit, getClientIdentifier } from "@/lib/rate-limit";

function safeEnvNumber(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function requestIdFor(request: NextRequest): string {
  const supplied = request.headers.get("x-request-id");
  return supplied && /^[A-Za-z0-9._-]{1,128}$/.test(supplied) ? supplied : crypto.randomUUID();
}

/**
 * Security headers applied to every response.
 *
 * The application already sets CSP, Referrer-Policy, Permissions-Policy,
 * X-Content-Type-Options, X-Frame-Options, COOP, and CORP via next.config.ts
 * headers(). The middleware supplements with HSTS (only in production) and
 * ensures the health endpoint also receives headers (it bypasses auth but
 * should not bypass security policy).
 *
 * We do NOT set CSP here to avoid conflicting with next.config.ts —
 * middleware headers would override the more complete next.config CSP.
 */
const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
};

function applySecurityHeaders(response: NextResponse): void {
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(key, value);
  }
  // HSTS only in production — setting it in dev/test can cause browsers
  // to cache the policy and force HTTPS on localhost.
  if (process.env.NODE_ENV === "production") {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=63072000; includeSubDomains; preload",
    );
  }
}

function continueRequest(request: NextRequest, requestId: string): NextResponse {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-request-id", requestId);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("x-request-id", requestId);
  applySecurityHeaders(response);
  return response;
}

function errorBody(
  request: NextRequest,
  requestId: string,
  status: number,
  message: string,
): NextResponse {
  const response = request.nextUrl.pathname.startsWith("/api/")
    ? NextResponse.json(
        { error: message, code: status === 401 ? "AUTH_REQUIRED" : "AUTH_MISCONFIGURED" },
        { status },
      )
    : new NextResponse(message, {
        status,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
  response.headers.set("x-request-id", requestId);
  applySecurityHeaders(response);
  return response;
}

export function proxy(request: NextRequest) {
  const requestId = requestIdFor(request);
  if (request.nextUrl.pathname === "/api/health") return continueRequest(request, requestId);

  const decision = evaluateAccess(request.headers.get("authorization") ?? undefined, {
    production: process.env.NODE_ENV === "production",
    allowUnauthenticated: process.env.TRAJECTORY_ALLOW_UNAUTHENTICATED === "true",
    username: process.env.TRAJECTORY_BASIC_AUTH_USER,
    password: process.env.TRAJECTORY_BASIC_AUTH_PASSWORD,
  });

  if (decision.kind === "allow") {
    // Rate limit API endpoints (health is already exempt above)
    if (request.nextUrl.pathname.startsWith("/api/")) {
      const clientId = getClientIdentifier(request);
      const limit = checkRateLimit(clientId, {
        maxRequests: safeEnvNumber(process.env.TRAJECTORY_RATE_LIMIT_MAX, 120),
        windowMs: safeEnvNumber(process.env.TRAJECTORY_RATE_LIMIT_WINDOW_MS, 60_000),
      });
      if (!limit.allowed) {
        const response = NextResponse.json(
          { error: "Rate limit exceeded", code: "RATE_LIMITED" },
          { status: 429 },
        );
        response.headers.set("x-request-id", requestId);
        response.headers.set("Retry-After", String(Math.ceil((limit.resetAt - Date.now()) / 1000)));
        applySecurityHeaders(response);
        return response;
      }
    }
    return continueRequest(request, requestId);
  }
  if (decision.kind === "misconfigured") {
    return errorBody(request, requestId, 503, "Production access control is not configured");
  }
  const response = errorBody(request, requestId, 401, "Authentication required");
  response.headers.set("WWW-Authenticate", 'Basic realm="Trajectory Arena", charset="UTF-8"');
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
