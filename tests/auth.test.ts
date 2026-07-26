import { describe, expect, it } from "vitest";
import { evaluateAccess } from "@/lib/auth";

const secureConfig = {
  production: true,
  allowUnauthenticated: false,
  username: "operator",
  password: "correct horse battery staple",
};

describe("production access policy", () => {
  it("allows development without credentials", () => {
    expect(
      evaluateAccess(undefined, {
        ...secureConfig,
        production: false,
        username: undefined,
        password: undefined,
      }),
    ).toEqual({ kind: "allow" });
  });

  it("allows an explicit unauthenticated production deployment", () => {
    expect(evaluateAccess(undefined, { ...secureConfig, allowUnauthenticated: true })).toEqual({
      kind: "allow",
    });
  });

  it("fails closed when production credentials are incomplete", () => {
    expect(
      evaluateAccess(undefined, {
        ...secureConfig,
        password: undefined,
      }),
    ).toEqual({ kind: "misconfigured" });
  });

  it("challenges missing or malformed credentials", () => {
    expect(evaluateAccess(undefined, secureConfig)).toEqual({ kind: "challenge" });
    expect(evaluateAccess("Bearer token", secureConfig)).toEqual({ kind: "challenge" });
    expect(evaluateAccess("Basic !!!", secureConfig)).toEqual({ kind: "challenge" });
  });

  it("accepts only the exact configured Basic credentials", () => {
    const accepted = `Basic ${Buffer.from("operator:correct horse battery staple").toString("base64")}`;
    const rejected = `Basic ${Buffer.from("operator:wrong").toString("base64")}`;

    expect(evaluateAccess(accepted, secureConfig)).toEqual({ kind: "allow" });
    expect(evaluateAccess(rejected, secureConfig)).toEqual({ kind: "challenge" });
  });
});
