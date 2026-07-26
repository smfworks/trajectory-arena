import { timingSafeEqual } from "node:crypto";

export interface AccessConfig {
  production: boolean;
  allowUnauthenticated: boolean;
  username?: string;
  password?: string;
}

export type AccessDecision = { kind: "allow" } | { kind: "challenge" } | { kind: "misconfigured" };

function equalSecret(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left, "utf8");
  const rightBytes = Buffer.from(right, "utf8");
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
}

function decodeBasic(header: string): { username: string; password: string } | null {
  const match = /^Basic ([A-Za-z0-9+/]+={0,2})$/.exec(header);
  if (!match) return null;
  const decoded = Buffer.from(match[1], "base64").toString("utf8");
  const separator = decoded.indexOf(":");
  if (separator < 0) return null;
  return {
    username: decoded.slice(0, separator),
    password: decoded.slice(separator + 1),
  };
}

export function evaluateAccess(
  authorization: string | undefined,
  config: AccessConfig,
): AccessDecision {
  if (!config.production || config.allowUnauthenticated) return { kind: "allow" };
  if (!config.username || !config.password) return { kind: "misconfigured" };
  if (!authorization) return { kind: "challenge" };

  const credentials = decodeBasic(authorization);
  if (!credentials) return { kind: "challenge" };
  const usernameMatches = equalSecret(credentials.username, config.username);
  const passwordMatches = equalSecret(credentials.password, config.password);
  return usernameMatches && passwordMatches ? { kind: "allow" } : { kind: "challenge" };
}
