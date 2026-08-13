import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { proxy } from "@/proxy";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Next.js production proxy", () => {
  it("allows development and propagates a validated request ID", () => {
    vi.stubEnv("NODE_ENV", "test");
    const response = proxy(
      new NextRequest("http://localhost/trajectories", {
        headers: { "x-request-id": "request-123" },
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("x-request-id")).toBe("request-123");
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("keeps health public but fails other production routes closed", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("TRAJECTORY_ALLOW_UNAUTHENTICATED", "false");
    vi.stubEnv("TRAJECTORY_BASIC_AUTH_USER", "");
    vi.stubEnv("TRAJECTORY_BASIC_AUTH_PASSWORD", "");

    const health = proxy(new NextRequest("http://localhost/api/health"));
    const denied = proxy(new NextRequest("http://localhost/api/tasks"));

    expect(health.status).toBe(200);
    expect(health.headers.get("x-request-id")).toBeTruthy();
    expect(denied.status).toBe(503);
    expect(await denied.json()).toMatchObject({ code: "AUTH_MISCONFIGURED" });
  });

  it("challenges bad credentials and accepts exact configured credentials", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("TRAJECTORY_ALLOW_UNAUTHENTICATED", "false");
    vi.stubEnv("TRAJECTORY_BASIC_AUTH_USER", "operator");
    vi.stubEnv("TRAJECTORY_BASIC_AUTH_PASSWORD", "secret-passphrase");

    const challenged = proxy(
      new NextRequest("http://localhost/api/tasks", {
        headers: { authorization: `Basic ${Buffer.from("operator:wrong").toString("base64")}` },
      }),
    );
    const accepted = proxy(
      new NextRequest("http://localhost/api/tasks", {
        headers: {
          authorization: `Basic ${Buffer.from("operator:secret-passphrase").toString("base64")}`,
        },
      }),
    );

    expect(challenged.status).toBe(401);
    expect(challenged.headers.get("www-authenticate")).toContain("Basic");
    expect(await challenged.json()).toMatchObject({ code: "AUTH_REQUIRED" });
    expect(accepted.status).toBe(200);
  });

  it("applies security headers to allowed responses", () => {
    vi.stubEnv("NODE_ENV", "test");
    const response = proxy(new NextRequest("http://localhost/trajectories"));

    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("x-frame-options")).toBe("DENY");
    expect(response.headers.get("referrer-policy")).toBe("strict-origin-when-cross-origin");
    expect(response.headers.get("permissions-policy")).toContain("geolocation=()");
    // HSTS should NOT be set in test/dev mode
    expect(response.headers.get("strict-transport-security")).toBeNull();
  });

  it("applies security headers to error responses", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("TRAJECTORY_ALLOW_UNAUTHENTICATED", "false");
    vi.stubEnv("TRAJECTORY_BASIC_AUTH_USER", "");
    vi.stubEnv("TRAJECTORY_BASIC_AUTH_PASSWORD", "");

    const response = proxy(new NextRequest("http://localhost/api/tasks"));

    expect(response.status).toBe(503);
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("x-frame-options")).toBe("DENY");
    // HSTS SHOULD be set in production
    expect(response.headers.get("strict-transport-security")).toContain("max-age=");
  });

  it("applies security headers to health endpoint", () => {
    vi.stubEnv("NODE_ENV", "production");
    const response = proxy(new NextRequest("http://localhost/api/health"));

    expect(response.status).toBe(200);
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("x-frame-options")).toBe("DENY");
    expect(response.headers.get("strict-transport-security")).toContain("max-age=");
  });
});
