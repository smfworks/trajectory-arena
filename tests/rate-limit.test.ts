import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { proxy } from "@/proxy";
import { checkRateLimit, resetRateLimit } from "@/lib/rate-limit";

afterEach(() => {
  vi.unstubAllEnvs();
  resetRateLimit();
});

beforeEach(() => {
  resetRateLimit();
});

describe("Rate limiting", () => {
  it("allows requests under the limit", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("TRAJECTORY_RATE_LIMIT_MAX", "5");

    for (let i = 0; i < 5; i++) {
      const response = proxy(
        new NextRequest("http://localhost/api/tasks", {
          headers: { "x-forwarded-for": "10.0.0.1" },
        }),
      );
      expect(response.status).toBe(200);
    }
  });

  it("blocks requests over the limit with 429", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("TRAJECTORY_RATE_LIMIT_MAX", "3");

    for (let i = 0; i < 3; i++) {
      proxy(
        new NextRequest("http://localhost/api/tasks", {
          headers: { "x-forwarded-for": "10.0.0.2" },
        }),
      );
    }

    const blocked = proxy(
      new NextRequest("http://localhost/api/tasks", {
        headers: { "x-forwarded-for": "10.0.0.2" },
      }),
    );

    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("retry-after")).toBeTruthy();
    const body = await blocked.json();
    expect(body.code).toBe("RATE_LIMITED");
  });

  it("tracks different IPs separately", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("TRAJECTORY_RATE_LIMIT_MAX", "2");

    // Exhaust IP A
    proxy(new NextRequest("http://localhost/api/tasks", {
      headers: { "x-forwarded-for": "10.0.0.10" },
    }));
    proxy(new NextRequest("http://localhost/api/tasks", {
      headers: { "x-forwarded-for": "10.0.0.10" },
    }));
    const blockedA = proxy(new NextRequest("http://localhost/api/tasks", {
      headers: { "x-forwarded-for": "10.0.0.10" },
    }));
    expect(blockedA.status).toBe(429);

    // IP B still works
    const responseB = proxy(new NextRequest("http://localhost/api/tasks", {
      headers: { "x-forwarded-for": "10.0.0.20" },
    }));
    expect(responseB.status).toBe(200);
  });

  it("does not rate limit non-API routes", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("TRAJECTORY_RATE_LIMIT_MAX", "1");

    // Use up the limit on API
    proxy(new NextRequest("http://localhost/api/tasks", {
      headers: { "x-forwarded-for": "10.0.0.3" },
    }));

    // Non-API route should still work
    const pageResponse = proxy(new NextRequest("http://localhost/trajectories", {
      headers: { "x-forwarded-for": "10.0.0.3" },
    }));
    expect(pageResponse.status).toBe(200);
  });

  it("does not rate limit the health endpoint", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("TRAJECTORY_RATE_LIMIT_MAX", "1");

    // Health doesn't count
    proxy(new NextRequest("http://localhost/api/health", {
      headers: { "x-forwarded-for": "10.0.0.4" },
    }));
    proxy(new NextRequest("http://localhost/api/health", {
      headers: { "x-forwarded-for": "10.0.0.4" },
    }));

    const healthResponse = proxy(new NextRequest("http://localhost/api/health", {
      headers: { "x-forwarded-for": "10.0.0.4" },
    }));
    expect(healthResponse.status).toBe(200);
  });
});

describe("checkRateLimit unit", () => {
  it("returns remaining count", () => {
    resetRateLimit();
    const result = checkRateLimit("test-client", { maxRequests: 10, windowMs: 1000 });
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(9);
  });

  it("blocks after threshold", () => {
    resetRateLimit();
    for (let i = 0; i < 5; i++) {
      checkRateLimit("blocked-client", { maxRequests: 5, windowMs: 10000 });
    }
    const result = checkRateLimit("blocked-client", { maxRequests: 5, windowMs: 10000 });
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("fails closed with safe defaults when maxRequests is NaN", () => {
    resetRateLimit();
    // NaN should fall back to default (120), not disable rate limiting
    const result = checkRateLimit("nan-client", { maxRequests: NaN });
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(119); // default 120 - 1
  });

  it("fails closed with safe defaults when maxRequests is negative", () => {
    resetRateLimit();
    const result = checkRateLimit("neg-client", { maxRequests: -5 });
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(119); // falls back to 120
  });

  it("fails closed with safe defaults when windowMs is NaN", () => {
    resetRateLimit();
    const result = checkRateLimit("nan-window", { maxRequests: 10, windowMs: NaN });
    expect(result.allowed).toBe(true);
    // Should use default 60s window
    expect(result.resetAt).toBeGreaterThan(Date.now());
  });
});