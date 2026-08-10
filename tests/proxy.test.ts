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
});
