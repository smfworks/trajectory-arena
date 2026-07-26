import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeRun, makeTask, makeTrajectory } from "./fixtures";

let dataDir: string;

beforeEach(() => {
  dataDir = mkdtempSync(join(tmpdir(), "trajectory-arena-storage-"));
  process.env.TRAJECTORY_DATA_DIR = dataDir;
  vi.resetModules();
});

afterEach(() => {
  delete process.env.TRAJECTORY_DATA_DIR;
  rmSync(dataDir, { recursive: true, force: true });
});

describe("storage trust boundary", () => {
  it("rejects unsafe IDs before any filesystem write escapes an entity directory", async () => {
    const { saveTask } = await import("@/lib/storage");

    expect(() => saveTask(makeTask({ id: "../escaped" }))).toThrow(/id/i);
    expect(existsSync(join(dataDir, "escaped.json"))).toBe(false);
  });

  it("does not persist malformed trajectories when validation or summary creation fails", async () => {
    const { saveTrajectory } = await import("@/lib/storage");
    const malformed = {
      id: "malformed",
      schemaVersion: "1.0.0",
      metadata: {},
      steps: [],
    };

    expect(() => saveTrajectory(malformed as never)).toThrow();
    expect(existsSync(join(dataDir, "trajectories", "malformed.json"))).toBe(false);
  });

  it("surfaces corrupt persisted JSON instead of silently reporting a missing record", async () => {
    const { loadTrajectory } = await import("@/lib/storage");
    const directory = join(dataDir, "trajectories");
    mkdirSync(directory, { recursive: true });
    writeFileSync(join(directory, "corrupt.json"), "{not-json", "utf8");

    expect(() => loadTrajectory("corrupt")).toThrow(/corrupt|json/i);
  });

  it("imports a coherent task, trajectory, and run graph without destroying metrics", async () => {
    const { exportTrajectory, importTrajectory, loadRun, loadTask, loadTrajectory } = await import(
      "@/lib/storage"
    );
    const original = makeTrajectory();

    const imported = importTrajectory(JSON.stringify(original));
    const exported = JSON.parse(exportTrajectory(imported.id));
    const persisted = loadTrajectory(imported.id);

    expect(exported.trajectory.metadata.stats.tokens).toEqual({
      input: 100,
      output: 50,
      total: 150,
    });
    expect(exported.trajectory.metadata.stats.durationMs).toBe(3000);
    expect(persisted?.metadata.stats.tokens.total).toBe(150);
    expect(loadTask(original.metadata.task.id)).toEqual(original.metadata.task);
    expect(loadRun(original.runId ?? "missing")?.trajectoryId).toBe(original.id);
  });

  it("refuses to delete a task while a trajectory still embeds it", async () => {
    const { deleteTask, saveTask, saveTrajectory } = await import("@/lib/storage");
    const task = makeTask();
    saveTask(task);
    saveTrajectory(makeTrajectory({ runId: undefined }));

    expect(() => deleteTask(task.id)).toThrow(/trajectory|referenced/i);
  });

  it("rejects symbolic-link entities instead of reading outside storage", async () => {
    const { loadTrajectory } = await import("@/lib/storage");
    const directory = join(dataDir, "trajectories");
    const external = join(dataDir, "external.json");
    mkdirSync(directory, { recursive: true });
    writeFileSync(external, JSON.stringify(makeTrajectory({ id: "linked" })), "utf8");
    symlinkSync(external, join(directory, "linked.json"));

    expect(() => loadTrajectory("linked")).toThrow(/symbolic link/i);
  });

  it("rejects symbolic-link collection directories on direct entity reads", async () => {
    const { initStorage, loadTrajectory } = await import("@/lib/storage");
    initStorage();
    const collection = join(dataDir, "trajectories");
    const external = mkdtempSync(join(tmpdir(), "trajectory-arena-external-"));
    writeFileSync(
      join(external, "linked.json"),
      JSON.stringify(makeTrajectory({ id: "linked" })),
      "utf8",
    );
    rmSync(collection, { recursive: true });
    symlinkSync(external, collection, "dir");
    try {
      expect(() => loadTrajectory("linked")).toThrow(/symbolic link|storage director/i);
    } finally {
      rmSync(collection, { force: true });
      rmSync(external, { recursive: true, force: true });
    }
  });

  it("rejects an entity whose content ID does not match its filename", async () => {
    const { loadTrajectory } = await import("@/lib/storage");
    const collection = join(dataDir, "trajectories");
    mkdirSync(collection, { recursive: true });
    writeFileSync(
      join(collection, "filename-id.json"),
      JSON.stringify(makeTrajectory({ id: "content-id" })),
      "utf8",
    );

    expect(() => loadTrajectory("filename-id")).toThrow(/content ID|filename|corrupt/i);
  });

  it("rolls back the complete graph when a later entity write fails", async () => {
    const { initStorage, saveTrajectory } = await import("@/lib/storage");
    initStorage();
    chmodSync(join(dataDir, "runs"), 0o500);
    try {
      expect(() =>
        saveTrajectory(makeTrajectory({ id: "rollback-trajectory", runId: "rollback-run" })),
      ).toThrow();
    } finally {
      chmodSync(join(dataDir, "runs"), 0o700);
    }

    expect(existsSync(join(dataDir, "tasks", "task-valid.json"))).toBe(false);
    expect(existsSync(join(dataDir, "trajectories", "rollback-trajectory.json"))).toBe(false);
    expect(existsSync(join(dataDir, "runs", "rollback-run.json"))).toBe(false);
  });

  it("fails closed while another live process owns the write lock", async () => {
    const { initStorage, saveTask } = await import("@/lib/storage");
    initStorage();
    const lockPath = join(dataDir, ".write.lock");
    writeFileSync(
      lockPath,
      JSON.stringify({ pid: process.pid, createdAt: new Date().toISOString() }),
    );
    try {
      expect(() => saveTask(makeTask())).toThrow(/busy|lock/i);
    } finally {
      rmSync(lockPath, { force: true });
    }
    expect(existsSync(join(dataDir, "tasks", "task-valid.json"))).toBe(false);
  });

  it("cascades a trajectory deletion to its run and then permits task deletion", async () => {
    const { deleteTask, deleteTrajectory, loadRun, loadTask, saveTrajectory } = await import(
      "@/lib/storage"
    );
    const trajectory = makeTrajectory();
    saveTrajectory(trajectory);

    expect(deleteTrajectory(trajectory.id)).toBe(true);
    expect(loadRun(trajectory.runId ?? "missing")).toBeNull();
    expect(loadTask(trajectory.metadata.task.id)).not.toBeNull();
    expect(deleteTask(trajectory.metadata.task.id)).toBe(true);
  });

  it("replaces a trajectory graph without leaving its previous run orphaned", async () => {
    const { listRuns, loadRun, saveTrajectory } = await import("@/lib/storage");
    const original = makeTrajectory();
    saveTrajectory(original);
    saveTrajectory(makeTrajectory({ runId: "replacement-run" }));

    expect(loadRun(original.runId ?? "missing")).toBeNull();
    expect(loadRun("replacement-run")?.trajectoryId).toBe(original.id);
    expect(listRuns()).toHaveLength(1);
  });

  it("rejects duplicate trajectory IDs in one batch without persisting an ambiguous graph", async () => {
    const { listRuns, loadTrajectory, saveTrajectories } = await import("@/lib/storage");
    const first = makeTrajectory({ id: "duplicate-trajectory", runId: "run-a" });
    const second = makeTrajectory({ id: "duplicate-trajectory", runId: "run-b" });

    expect(() => saveTrajectories([first, second])).toThrow(/duplicate trajectory/i);
    expect(loadTrajectory("duplicate-trajectory")).toBeNull();
    expect(listRuns()).toHaveLength(0);
  });

  it("fails health when the persisted task, trajectory, and run graph is inconsistent", async () => {
    const { getStorageHealth, saveTrajectory } = await import("@/lib/storage");
    saveTrajectory(makeTrajectory());
    rmSync(join(dataDir, "tasks", "task-valid.json"));

    expect(() => getStorageHealth()).toThrow(/task|integrity|corrupt/i);
  });

  it("fails health when a writable deployment cannot write an entity collection", async () => {
    const { getStorageHealth, initStorage } = await import("@/lib/storage");
    initStorage();
    const runsDirectory = join(dataDir, "runs");
    chmodSync(runsDirectory, 0o500);
    try {
      expect(() => getStorageHealth()).toThrow();
    } finally {
      chmodSync(runsDirectory, 0o700);
    }
  });

  it("does not steal an old lock from the same live process", async () => {
    const { initStorage, saveTask } = await import("@/lib/storage");
    initStorage();
    const stat = readFileSync(`/proc/${process.pid}/stat`, "utf8");
    const processStartTime = stat.slice(stat.lastIndexOf(")") + 2).split(" ")[19];
    writeFileSync(
      join(dataDir, ".write.lock"),
      JSON.stringify({
        pid: process.pid,
        processStartTime,
        token: "existing-live-owner",
        createdAt: "2000-01-01T00:00:00.000Z",
      }),
    );

    expect(() => saveTask(makeTask())).toThrow(/busy|lock/i);
  });

  it("recovers an expired write lock when its PID has been reused", async () => {
    const { initStorage, loadTask, saveTask } = await import("@/lib/storage");
    initStorage();
    writeFileSync(
      join(dataDir, ".write.lock"),
      JSON.stringify({
        pid: process.pid,
        processStartTime: "not-the-current-process",
        token: "expired-owner",
        createdAt: "2000-01-01T00:00:00.000Z",
      }),
    );

    saveTask(makeTask());
    expect(loadTask("task-valid")).not.toBeNull();
  });

  it("rejects direct runs that do not exactly match the trajectory-declared run", async () => {
    const { loadRun, saveRun, saveTrajectory } = await import("@/lib/storage");
    const trajectory = makeTrajectory({ runId: undefined });
    saveTrajectory(trajectory);

    expect(() => saveRun(makeRun({ id: "undeclared-run", trajectoryId: trajectory.id }))).toThrow(
      /declared run|run ID|trajectory/i,
    );
    expect(loadRun("undeclared-run")).toBeNull();
  });

  it("recovers a partially applied graph from the durable transaction journal", async () => {
    const { getStorageHealth, loadRun, loadTrajectory, saveTrajectory } = await import(
      "@/lib/storage"
    );
    const original = makeTrajectory();
    saveTrajectory(original);
    const trajectoryPath = join(dataDir, "trajectories", `${original.id}.json`);
    const runPath = join(dataDir, "runs", `${original.runId}.json`);
    const snapshots = [
      {
        collection: "trajectories",
        id: original.id,
        contents: readFileSync(trajectoryPath, "utf8"),
      },
      {
        collection: "runs",
        id: original.runId,
        contents: readFileSync(runPath, "utf8"),
      },
    ];
    writeFileSync(
      join(dataDir, ".transaction.json"),
      JSON.stringify({ version: 1, snapshots }),
      "utf8",
    );
    writeFileSync(trajectoryPath, JSON.stringify(makeTrajectory({ runId: "partial-run" })), "utf8");
    rmSync(runPath);

    expect(getStorageHealth()).toMatchObject({ trajectories: 1, tasks: 1, runs: 1 });
    expect(loadTrajectory(original.id)?.runId).toBe(original.runId);
    expect(loadRun(original.runId ?? "missing")?.trajectoryId).toBe(original.id);
    expect(existsSync(join(dataDir, ".transaction.json"))).toBe(false);
  });

  it("rejects conflicting embedded tasks and run IDs without partial writes", async () => {
    const { loadRun, loadTask, loadTrajectory, saveTrajectory } = await import("@/lib/storage");
    const original = makeTrajectory();
    saveTrajectory(original);

    const conflictingTask = makeTrajectory({
      id: "conflicting-task-trajectory",
      runId: "conflicting-task-run",
      metadata: {
        ...original.metadata,
        task: { ...original.metadata.task, title: "A different task contract" },
      },
    });
    expect(() => saveTrajectory(conflictingTask)).toThrow(/task.*conflict|conflicting task/i);
    expect(loadTask(original.metadata.task.id)?.title).toBe(original.metadata.task.title);
    expect(loadTrajectory(conflictingTask.id)).toBeNull();

    const collidingRun = makeTrajectory({ id: "colliding-run-trajectory", runId: original.runId });
    expect(() => saveTrajectory(collidingRun)).toThrow(/run.*trajectory|run.*conflict/i);
    expect(loadRun(original.runId ?? "missing")?.trajectoryId).toBe(original.id);
    expect(loadTrajectory(collidingRun.id)).toBeNull();
  });

  it("rejects direct edits to a task contract already embedded in a trajectory", async () => {
    const { loadTask, saveTask, saveTrajectory } = await import("@/lib/storage");
    const trajectory = makeTrajectory();
    saveTrajectory(trajectory);

    expect(() =>
      saveTask(
        makeTask({ title: "Replacement contract", successCriteria: ["Different criterion"] }),
      ),
    ).toThrow(/task.*referenced|task.*conflict/i);
    expect(loadTask(trajectory.metadata.task.id)).toEqual(trajectory.metadata.task);
  });

  it("seeds one deterministic and internally coherent example graph", async () => {
    const { seedExampleData } = await import("@/lib/examples");
    const { listRuns, listTasks, listTrajectories } = await import("@/lib/storage");

    await seedExampleData();
    await seedExampleData();

    expect(listTasks()).toHaveLength(1);
    expect(listTrajectories()).toHaveLength(2);
    expect(listRuns()).toHaveLength(2);
    expect(
      listTrajectories()
        .map((item) => item.id)
        .sort(),
    ).toEqual(["example-todo-partial-v1", "example-todo-success-v1"]);
  });

  it("requires an explicit absolute data directory in production", async () => {
    const { getDataDir } = await import("@/lib/storage");
    delete process.env.TRAJECTORY_DATA_DIR;
    vi.stubEnv("NODE_ENV", "production");

    expect(() => getDataDir()).toThrow(/explicit absolute path/i);
    vi.unstubAllEnvs();
  });
});
