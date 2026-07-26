import { chmodSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as importTrajectory } from "@/app/api/import/route";
import { POST as postTask } from "@/app/api/tasks/route";
import { GET as listTrajectories, POST as postTrajectory } from "@/app/api/trajectories/route";
import { errorResponse, readJsonBody, requireWritable } from "@/lib/api";
import { makeTask, makeTrajectory } from "./fixtures";

let dataDir: string;

function jsonRequest(
  url: string,
  method: string,
  body: unknown,
  headers?: HeadersInit,
): NextRequest {
  return new NextRequest(url, {
    method,
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  dataDir = mkdtempSync(join(tmpdir(), "trajectory-arena-api-"));
  process.env.TRAJECTORY_DATA_DIR = dataDir;
  delete process.env.TRAJECTORY_READ_ONLY;
});

afterEach(() => {
  delete process.env.TRAJECTORY_DATA_DIR;
  delete process.env.TRAJECTORY_READ_ONLY;
  rmSync(dataDir, { recursive: true, force: true });
});

describe("API trust boundary", () => {
  it("returns 400 and performs no write for path traversal IDs", async () => {
    const response = await postTask(
      jsonRequest("http://localhost/api/tasks", "POST", makeTask({ id: "../escaped" })),
    );

    expect(response.status).toBe(400);
    expect(existsSync(join(dataDir, "escaped.json"))).toBe(false);
  });

  it("returns 400 and performs no partial write for malformed trajectories", async () => {
    const response = await postTrajectory(
      jsonRequest("http://localhost/api/trajectories", "POST", {
        schemaVersion: "1.0.0",
        id: "malformed",
        metadata: {},
        steps: [],
      }),
    );

    expect(response.status).toBe(400);
    expect(existsSync(join(dataDir, "trajectories", "malformed.json"))).toBe(false);
  });

  it("returns 400 for invalid pagination instead of silently treating NaN as unbounded", async () => {
    const response = listTrajectories(
      new NextRequest("http://localhost/api/trajectories?limit=not-a-number&offset=-1"),
    );

    expect(response.status).toBe(400);
  });

  it("rejects declared oversized JSON payloads before parsing", async () => {
    const response = await postTrajectory(
      jsonRequest(
        "http://localhost/api/trajectories",
        "POST",
        {},
        {
          "content-length": String(10 * 1024 * 1024 + 1),
        },
      ),
    );

    expect(response.status).toBe(413);
  });

  it("fails writes closed when read-only mode is enabled", async () => {
    process.env.TRAJECTORY_READ_ONLY = "true";
    const response = await postTask(jsonRequest("http://localhost/api/tasks", "POST", makeTask()));

    expect(response.status).toBe(403);
  });

  it("rejects unsupported schema versions during import", async () => {
    const trajectory = { ...makeTrajectory(), schemaVersion: "2.0.0" };
    const response = await importTrajectory(
      jsonRequest("http://localhost/api/import", "POST", { trajectory, source: "test" }),
    );

    expect(response.status).toBe(400);
  });

  it("rejects cross-origin browser mutations", async () => {
    const response = await postTask(
      jsonRequest("http://localhost/api/tasks", "POST", makeTask(), {
        origin: "https://attacker.example",
        "sec-fetch-site": "cross-site",
      }),
    );

    expect(response.status).toBe(403);
  });

  it("rejects originless production mutations even without a configured public origin", () => {
    vi.stubEnv("NODE_ENV", "production");
    try {
      expect(() =>
        requireWritable(new Request("https://arena.example/api/tasks", { method: "POST" })),
      ).toThrow(/origin/i);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("allows an explicit production override for trusted originless API clients", () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.TRAJECTORY_ALLOW_ORIGINLESS_MUTATIONS = "true";
    try {
      expect(() =>
        requireWritable(new Request("https://arena.example/api/tasks", { method: "POST" })),
      ).not.toThrow();
    } finally {
      delete process.env.TRAJECTORY_ALLOW_ORIGINLESS_MUTATIONS;
      vi.unstubAllEnvs();
    }
  });

  it("maps real lock-file permission failures to storage unavailable", async () => {
    chmodSync(dataDir, 0o500);
    try {
      const response = await postTask(
        jsonRequest("http://localhost/api/tasks", "POST", makeTask()),
      );
      expect(response.status).toBe(503);
      await expect(response.json()).resolves.toMatchObject({ code: "STORAGE_UNAVAILABLE" });
    } finally {
      chmodSync(dataDir, 0o700);
    }
  });

  it("stops reading an undeclared stream as soon as it exceeds the body limit", async () => {
    const chunk = new TextEncoder().encode(" ".repeat(1024 * 1024));
    let pulls = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulls += 1;
        if (pulls <= 11) controller.enqueue(chunk);
        else controller.close();
      },
    });
    const request = new Request("http://localhost/api/import", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      duplex: "half",
    } as RequestInit & { duplex: "half" });

    await expect(readJsonBody(request)).rejects.toMatchObject({ status: 413 });
    expect(pulls).toBe(11);
  });

  it("cancels a declared oversized body before rejecting it", async () => {
    let cancellations = 0;
    const body = new ReadableStream<Uint8Array>({
      cancel() {
        cancellations += 1;
      },
    });
    const request = new Request("http://localhost/api/import", {
      method: "POST",
      headers: { "content-type": "application/json", "content-length": "2" },
      body,
      duplex: "half",
    } as RequestInit & { duplex: "half" });

    await expect(readJsonBody(request, 1)).rejects.toMatchObject({ status: 413 });
    expect(cancellations).toBe(1);
  });

  it("preserves the payload-too-large response when stream cancellation fails", async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array([1, 2]));
      },
      cancel() {
        throw new Error("transport cancel failed");
      },
    });
    const request = new Request("http://localhost/api/import", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      duplex: "half",
    } as RequestInit & { duplex: "half" });

    await expect(readJsonBody(request, 1)).rejects.toMatchObject({
      status: 413,
      code: "PAYLOAD_TOO_LARGE",
    });
  });

  it("maps direct and transactional filesystem failures to typed service-unavailable responses", async () => {
    const filesystemError = Object.assign(new Error("read-only filesystem"), { code: "EROFS" });
    const directResponse = errorResponse(filesystemError);
    const transactionalResponse = errorResponse(
      new AggregateError(
        [Object.assign(new Error("unrelated failure"), { code: "EIO" }), filesystemError],
        "transaction failed",
      ),
    );

    for (const response of [directResponse, transactionalResponse]) {
      expect(response.status).toBe(503);
      await expect(response.json()).resolves.toEqual({
        error: "Storage is temporarily unavailable",
        code: "STORAGE_UNAVAILABLE",
      });
    }
  });

  it("returns no-store on successful API responses", async () => {
    const createResponse = await postTrajectory(
      jsonRequest("http://localhost/api/trajectories", "POST", makeTrajectory()),
    );
    const listResponse = listTrajectories(new NextRequest("http://localhost/api/trajectories"));

    expect(createResponse.status).toBe(201);
    expect(listResponse.headers.get("cache-control")).toContain("no-store");
  });
});
