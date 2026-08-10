import type { TaskDefinition, TaskRun, Trajectory, TrajectoryStep } from "@/lib/schema";
import { TRAJECTORY_SCHEMA_VERSION } from "@/lib/schema";

export function makeTask(overrides: Partial<TaskDefinition> = {}): TaskDefinition {
  return {
    id: "task-valid",
    title: "Valid task",
    description: "A complete task used by the automated test suite.",
    successCriteria: ["The requested behavior works"],
    starterFiles: [],
    testCommands: ["npm test"],
    tags: ["test"],
    createdAt: "2026-07-26T10:00:00.000Z",
    updatedAt: "2026-07-26T10:00:00.000Z",
    ...overrides,
  };
}

export function makeSteps(): TrajectoryStep[] {
  return [
    {
      stepIndex: 0,
      timestamp: "2026-07-26T10:00:00.000Z",
      type: "message",
      data: { message: { text: "Build it", sender: "user" } },
    },
    {
      stepIndex: 1,
      timestamp: "2026-07-26T10:00:01.000Z",
      type: "file_edit",
      data: {
        fileEdit: {
          filePath: "src/index.ts",
          operation: "create",
          newContent: "export const answer = 42;\n",
          diff: [{ type: "add", content: "export const answer = 42;", newLineNumber: 1 }],
        },
      },
    },
    {
      stepIndex: 2,
      timestamp: "2026-07-26T10:00:02.000Z",
      type: "test_result",
      data: {
        testResult: {
          testName: "npm test",
          status: "pass",
          output: "1 passed",
          durationMs: 250,
        },
      },
    },
  ];
}

export function makeTrajectory(overrides: Partial<Trajectory> = {}): Trajectory {
  const steps = makeSteps();
  return {
    schemaVersion: TRAJECTORY_SCHEMA_VERSION,
    id: "trajectory-valid",
    runId: "run-valid",
    metadata: {
      task: makeTask(),
      model: { name: "test-model", provider: "test-provider", config: {} },
      environment: {
        os: "linux",
        workingDir: "/workspace/project",
        nodeVersion: "v24.0.0",
        timestamp: "2026-07-26T10:00:00.000Z",
      },
      timing: {
        startedAt: "2026-07-26T10:00:00.000Z",
        endedAt: "2026-07-26T10:00:03.000Z",
        durationMs: 3000,
      },
      stats: {
        totalSteps: 3,
        reasoningSteps: 0,
        toolCalls: 0,
        fileEdits: 1,
        terminalCommands: 0,
        testResults: 1,
        toolsUsed: [],
        filesModified: ["src/index.ts"],
        tokens: { input: 100, output: 50, total: 150 },
        durationMs: 3000,
      },
    },
    steps,
    outcome: {
      status: "success",
      summary: "The task completed successfully.",
      testResults: [{ name: "npm test", status: "pass", output: "1 passed", durationMs: 250 }],
    },
    ...overrides,
  };
}

export function makeRun(overrides: Partial<TaskRun> = {}): TaskRun {
  return {
    id: "run-valid",
    taskId: "task-valid",
    trajectoryId: "trajectory-valid",
    model: { name: "test-model", provider: "test-provider", config: {} },
    status: "success",
    startedAt: "2026-07-26T10:00:00.000Z",
    endedAt: "2026-07-26T10:00:03.000Z",
    durationMs: 3000,
    testResults: [{ name: "npm test", status: "pass", output: "1 passed", durationMs: 250 }],
    ...overrides,
  };
}
