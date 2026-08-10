import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET as health } from "@/app/api/health/route";
import { POST as importRoute } from "@/app/api/import/route";
import { GET as leaderboard } from "@/app/api/leaderboard/route";
import { GET as runs } from "@/app/api/runs/route";
import { POST as seed } from "@/app/api/seed/route";
import { GET as taskDetail } from "@/app/api/tasks/[id]/route";
import { POST as createTask, DELETE as deleteTask, GET as tasks } from "@/app/api/tasks/route";
import { GET as exportTrajectory } from "@/app/api/trajectories/[id]/export/route";
import {
  DELETE as deleteTrajectoryDetail,
  GET as trajectoryDetail,
} from "@/app/api/trajectories/[id]/route";
import { DELETE as deleteTrajectory, GET as trajectories } from "@/app/api/trajectories/route";
import { makeTask, makeTrajectory } from "./fixtures";

let dataDir: string;

function request(url: string, method = "GET", body?: unknown): NextRequest {
  return new NextRequest(url, {
    method,
    ...(body === undefined
      ? {}
      : { headers: { "content-type": "application/json" }, body: JSON.stringify(body) }),
  });
}

beforeEach(() => {
  dataDir = mkdtempSync(join(tmpdir(), "trajectory-arena-routes-"));
  process.env.TRAJECTORY_DATA_DIR = dataDir;
  delete process.env.TRAJECTORY_READ_ONLY;
});

afterEach(() => {
  delete process.env.TRAJECTORY_DATA_DIR;
  delete process.env.TRAJECTORY_READ_ONLY;
  rmSync(dataDir, { recursive: true, force: true });
});

describe("route integration", () => {
  it("reports healthy empty storage with versioned no-store output", async () => {
    const response = health();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(await response.json()).toMatchObject({
      status: "ok",
      version: "1.0.0",
      schemaVersion: "1.0.0",
      storage: { trajectories: 0, tasks: 0, runs: 0 },
    });
  });

  it("seeds and exposes a coherent graph through every read route", async () => {
    expect((await seed(request("http://localhost/api/seed", "POST"))).status).toBe(200);

    const taskList = await (await tasks()).json();
    const trajectoryList = await trajectories(request("http://localhost/api/trajectories"));
    const runList = await runs(request("http://localhost/api/runs?taskId=task-todo-list"));
    const ranking = await leaderboard(
      request("http://localhost/api/leaderboard?taskId=task-todo-list"),
    );

    expect(taskList).toHaveLength(1);
    expect(await trajectoryList.json()).toHaveLength(2);
    expect(await runList.json()).toHaveLength(2);
    expect(await ranking.json()).toHaveLength(2);

    const taskResponse = await taskDetail(request("http://localhost/api/tasks/task-todo-list"), {
      params: Promise.resolve({ id: "task-todo-list" }),
    });
    expect(taskResponse.status).toBe(200);

    const id = "example-todo-success-v1";
    const detailResponse = await trajectoryDetail(
      request(`http://localhost/api/trajectories/${id}`),
      { params: Promise.resolve({ id }) },
    );
    const exportResponse = await exportTrajectory(
      request(`http://localhost/api/trajectories/${id}/export`),
      { params: Promise.resolve({ id }) },
    );
    expect(detailResponse.status).toBe(200);
    expect(exportResponse.status).toBe(200);
    expect(exportResponse.headers.get("content-disposition")).toContain(id);
  });

  it("returns typed not-found and invalid-query responses", async () => {
    const missingTask = await taskDetail(request("http://localhost/api/tasks/missing"), {
      params: Promise.resolve({ id: "missing" }),
    });
    const missingTrajectory = await trajectoryDetail(
      request("http://localhost/api/trajectories/missing"),
      { params: Promise.resolve({ id: "missing" }) },
    );
    const missingExport = await exportTrajectory(
      request("http://localhost/api/trajectories/missing/export"),
      { params: Promise.resolve({ id: "missing" }) },
    );
    const invalidRuns = await runs(request("http://localhost/api/runs?taskId=../bad"));
    const missingLeaderboard = await leaderboard(request("http://localhost/api/leaderboard"));

    expect(missingTask.status).toBe(404);
    expect(missingTrajectory.status).toBe(404);
    expect(missingExport.status).toBe(404);
    expect(invalidRuns.status).toBe(400);
    expect(missingLeaderboard.status).toBe(400);
  });

  it("enforces reference-safe deletes and cascades run deletion", async () => {
    const trajectory = makeTrajectory();
    expect(
      (
        await importRoute(
          request("http://localhost/api/import", "POST", {
            trajectory,
            source: "route-test",
          }),
        )
      ).status,
    ).toBe(201);

    expect(
      deleteTask(request(`http://localhost/api/tasks?id=${trajectory.metadata.task.id}`, "DELETE"))
        .status,
    ).toBe(409);
    expect(
      (
        await deleteTrajectoryDetail(
          request(`http://localhost/api/trajectories/${trajectory.id}`, "DELETE"),
          { params: Promise.resolve({ id: trajectory.id }) },
        )
      ).status,
    ).toBe(200);
    expect(
      deleteTask(request(`http://localhost/api/tasks?id=${trajectory.metadata.task.id}`, "DELETE"))
        .status,
    ).toBe(200);
    expect(
      deleteTrajectory(request("http://localhost/api/trajectories?id=missing", "DELETE")).status,
    ).toBe(404);
  });

  it("validates import envelopes and task collection operations", async () => {
    expect((await importRoute(request("http://localhost/api/import", "POST", []))).status).toBe(
      400,
    );
    expect(
      (
        await importRoute(
          request("http://localhost/api/import", "POST", { trajectory: 42, source: "test" }),
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await importRoute(
          request("http://localhost/api/import", "POST", {
            trajectory: makeTrajectory(),
            source: "x".repeat(257),
          }),
        )
      ).status,
    ).toBe(400);

    const create = await createTask(
      request("http://localhost/api/tasks", "POST", {
        title: "Route-created task",
        description: "Created without a client-provided ID",
        successCriteria: [],
        starterFiles: [],
        testCommands: [],
        tags: [],
      }),
    );
    expect(create.status).toBe(201);
    expect(await (await tasks()).json()).toHaveLength(1);
  });

  it("disables mutation in read-only mode", async () => {
    process.env.TRAJECTORY_READ_ONLY = "true";
    expect((await seed(request("http://localhost/api/seed", "POST"))).status).toBe(403);
    expect(
      (await createTask(request("http://localhost/api/tasks", "POST", makeTask()))).status,
    ).toBe(403);
    const response = health();
    expect(response.status).toBe(200);
    expect((await response.json()).storage.writable).toBe(false);
  });

  it("marks corrupt storage unhealthy without disclosing details", async () => {
    const directory = join(dataDir, "trajectories");
    mkdirSync(directory, { recursive: true });
    writeFileSync(join(directory, "corrupt.json"), "{bad-json", "utf8");

    const response = health();
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ status: "unhealthy", version: "1.0.0" });
  });
});
