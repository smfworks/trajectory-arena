import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { evaluateAccess } from "@/lib/auth";

function requestIdFor(request: NextRequest): string {
  const supplied = request.headers.get("x-request-id");
  return supplied && /^[A-Za-z0-9._-]{1,128}$/.test(supplied) ? supplied : crypto.randomUUID();
}

function continueRequest(request: NextRequest, requestId: string): NextResponse {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-request-id", requestId);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("x-request-id", requestId);
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

  if (decision.kind === "allow") return continueRequest(request, requestId);
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
