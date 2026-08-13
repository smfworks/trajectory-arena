/**
 * Simple in-memory rate limiter for API endpoints.
 *
 * Uses a sliding-window counter per client IP. Intentionally lightweight —
 * no external dependencies, no persistent state. Appropriate for a
 * single-operator application that may be exposed to the internet behind
 * Basic auth but needs a backstop against brute-force or flooding.
 *
 * For multi-instance deployments, replace with a Redis-backed limiter.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, RateLimitEntry>();

/** Prune expired entries periodically to prevent unbounded growth. */
const PRUNE_INTERVAL_MS = 60_000;
const MAX_BUCKETS = 10_000;
let lastPrune = Date.now();

function pruneExpired(now: number): void {
  if (now - lastPrune < PRUNE_INTERVAL_MS) return;
  lastPrune = now;
  for (const [key, entry] of buckets) {
    if (entry.resetAt <= now) buckets.delete(key);
  }
  // Hard cap: if an attacker spoofs millions of unique X-Forwarded-For
  // values, evict oldest entries to prevent unbounded memory growth.
  if (buckets.size > MAX_BUCKETS) {
    const sorted = [...buckets.entries()].sort((a, b) => a[1].resetAt - b[1].resetAt);
    const toRemove = sorted.length - MAX_BUCKETS;
    for (let i = 0; i < toRemove; i++) {
      buckets.delete(sorted[i][0]);
    }
  }
}

export interface RateLimitOptions {
  /** Maximum requests allowed within the window. Default: 120. */
  maxRequests?: number;
  /** Window duration in milliseconds. Default: 60_000 (1 minute). */
  windowMs?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * Parse a numeric env var with fallback. Returns the fallback if the
 * parsed value is NaN, negative, or not finite. This ensures the rate
 * limiter fails closed (uses safe defaults) rather than open (disabled)
 * when env vars are misconfigured.
 */
function safeNumber(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function checkRateLimit(
  identifier: string,
  options: RateLimitOptions = {},
): RateLimitResult {
  const maxRequests = safeNumber(options.maxRequests, 120);
  const windowMs = safeNumber(options.windowMs, 60_000);
  const now = Date.now();

  pruneExpired(now);

  const existing = buckets.get(identifier);

  if (existing && existing.resetAt > now) {
    if (existing.count >= maxRequests) {
      return { allowed: false, remaining: 0, resetAt: existing.resetAt };
    }
    existing.count++;
    return { allowed: true, remaining: maxRequests - existing.count, resetAt: existing.resetAt };
  }

  const resetAt = now + windowMs;
  buckets.set(identifier, { count: 1, resetAt });
  return { allowed: true, remaining: maxRequests - 1, resetAt };
}

/**
 * Extract a client identifier from a NextRequest.
 * Prefers X-Forwarded-For (first IP), falls back to the request's IP property,
 * then to a synthetic "unknown" key so that rate limiting still functions
 * behind proxies that strip headers.
 */
export function getClientIdentifier(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const firstIp = forwarded.split(",")[0].trim();
    if (firstIp) return `ip:${firstIp}`;
  }

  // NextRequest may carry an `ip` property via edge runtime
  const nextIp = (request as unknown as { ip?: string }).ip;
  if (nextIp) return `ip:${nextIp}`;

  return "ip:unknown";
}

/** Clear all rate limit state — useful for testing. */
export function resetRateLimit(): void {
  buckets.clear();
  lastPrune = Date.now();
}