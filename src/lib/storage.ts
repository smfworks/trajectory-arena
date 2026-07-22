/**
 * Trajectory Arena — Storage Layer
 *
 * Local-first storage using JSON files. Each entity type (trajectories,
 * tasks, runs) has its own directory with one JSON file per entity.
 * An index file (index.json) in each directory provides fast listing.
 *
 * Storage layout:
 *   data/
 *     trajectories/
 *       index.json         — Array of trajectory summaries
 *       <id>.json          — Full trajectory data
 *     tasks/
 *       index.json         — Array of task summaries
 *       <id>.json          — Full task definition
 *     runs/
 *       index.json         — Array of run summaries
 *       <id>.json          — Full run data
 *
 * @see ARCHITECTURE.md for design rationale
 */

import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync, unlinkSync } from "fs";
import { join } from "path";
import { v4 as uuidv4 } from "uuid";
import type {
  Trajectory,
  TrajectoryId,
  TaskDefinition,
  TaskId,
  TaskRun,
  RunId,
  LeaderboardEntry,
  TrajectoryStats,
} from "./schema";
export type {
  Trajectory,
  TrajectoryId,
  TaskDefinition,
  TaskId,
  TaskRun,
  RunId,
  LeaderboardEntry,
  TrajectoryStats,
} from "./schema";
export { TRAJECTORY_SCHEMA_VERSION } from "./schema";
import { TRAJECTORY_SCHEMA_VERSION } from "./schema";

/** Base data directory. */
const DATA_DIR = process.env.TRAJECTORY_DATA_DIR || join(process.cwd(), "data");

/** Path to the trajectories directory. */
const TRAJECTORIES_DIR = join(DATA_DIR, "trajectories");

/** Path to the tasks directory. */
const TASKS_DIR = join(DATA_DIR, "tasks");

/** Path to the runs directory. */
const RUNS_DIR = join(DATA_DIR, "runs");

/**
 * Initialize the storage layer — creates directories.
 */
export function initStorage(): void {
  for (const dir of [DATA_DIR, TRAJECTORIES_DIR, TASKS_DIR, RUNS_DIR]) {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }
}

/**
 * Get the data directory path.
 */
export function getDataDir(): string {
  return DATA_DIR;
}

/**
 * Read a JSON file.
 */
function readJson<T>(path: string): T | null {
  if (!existsSync(path)) {
    return null;
  }
  try {
    const data = readFileSync(path, "utf-8");
    return JSON.parse(data) as T;
  } catch {
    return null;
  }
}

/**
 * Write a JSON file.
 */
function writeJson(path: string, data: unknown): void {
  writeFileSync(path, JSON.stringify(data, null, 2), "utf-8");
}

/**
 * Read an index file (array of summaries).
 */
function readIndex<T>(dir: string): T[] {
  const index = readJson<T[]>(join(dir, "index.json"));
  return index || [];
}

/**
 * Write an index file.
 */
function writeIndex<T>(dir: string, items: T[]): void {
  writeJson(join(dir, "index.json"), items);
}

/**
 * Get the path to a trajectory JSON file.
 */
function getTrajectoryFilePath(id: TrajectoryId): string {
  return join(TRAJECTORIES_DIR, `${id}.json`);
}

/**
 * Get the path to a task JSON file.
 */
function getTaskFilePath(id: TaskId): string {
  return join(TASKS_DIR, `${id}.json`);
}

/**
 * Get the path to a run JSON file.
 */
function getRunFilePath(id: RunId): string {
  return join(RUNS_DIR, `${id}.json`);
}

/**
 * Compute statistics for a trajectory from its steps.
 */
export function computeStats(steps: Trajectory["steps"]): TrajectoryStats {
  const toolsUsed = new Set<string>();
  const filesModified = new Set<string>();
  let reasoningSteps = 0;
  let toolCalls = 0;
  let fileEdits = 0;
  let terminalCommands = 0;
  let testResults = 0;

  for (const step of steps) {
    switch (step.type) {
      case "reasoning":
        reasoningSteps++;
        break;
      case "tool_call":
        toolCalls++;
        if (step.data.toolCall) {
          toolsUsed.add(step.data.toolCall.name);
        }
        break;
      case "file_edit":
        fileEdits++;
        if (step.data.fileEdit) {
          filesModified.add(step.data.fileEdit.filePath);
        }
        break;
      case "terminal":
        terminalCommands++;
        break;
      case "test_result":
        testResults++;
        break;
    }
  }

  return {
    totalSteps: steps.length,
    reasoningSteps,
    toolCalls,
    fileEdits,
    terminalCommands,
    testResults,
    toolsUsed: Array.from(toolsUsed).sort(),
    filesModified: Array.from(filesModified).sort(),
    tokens: { input: 0, output: 0, total: 0 },
    durationMs: 0,
  };
}

/**
 * A lightweight summary of a trajectory for list views.
 */
export interface TrajectorySummary {
  id: TrajectoryId;
  runId: RunId | null;
  title: string;
  description: string;
  modelName: string;
  provider: string;
  status: string;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  stepsCount: number;
  tokensInput: number;
  tokensOutput: number;
  tokensTotal: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Convert a trajectory to a summary.
 */
function trajectoryToSummary(t: Trajectory): TrajectorySummary {
  return {
    id: t.id,
    runId: t.runId || null,
    title: t.metadata.task.title,
    description: t.metadata.task.description,
    modelName: t.metadata.model.name,
    provider: t.metadata.model.provider,
    status: t.outcome.status,
    startedAt: t.metadata.timing.startedAt,
    endedAt: t.metadata.timing.endedAt,
    durationMs: t.metadata.timing.durationMs,
    stepsCount: t.metadata.stats.totalSteps,
    tokensInput: t.metadata.stats.tokens.input,
    tokensOutput: t.metadata.stats.tokens.output,
    tokensTotal: t.metadata.stats.tokens.total,
    createdAt: t.metadata.timing.startedAt,
    updatedAt: t.metadata.timing.endedAt,
  };
}

// ============================================================================
// Trajectory CRUD
// ============================================================================

/**
 * Save a trajectory to storage.
 */
export function saveTrajectory(trajectory: Trajectory): void {
  initStorage();

  // Write JSON file
  writeJson(getTrajectoryFilePath(trajectory.id), trajectory);

  // Update index
  const index = readIndex<TrajectorySummary>(TRAJECTORIES_DIR);
  const summary = trajectoryToSummary(trajectory);
  const existing = index.findIndex((t) => t.id === trajectory.id);
  if (existing >= 0) {
    index[existing] = summary;
  } else {
    index.unshift(summary);
  }
  writeIndex(TRAJECTORIES_DIR, index);
}

/**
 * Load a trajectory by ID.
 */
export function loadTrajectory(id: TrajectoryId): Trajectory | null {
  return readJson<Trajectory>(getTrajectoryFilePath(id));
}

/**
 * Delete a trajectory by ID.
 */
export function deleteTrajectory(id: TrajectoryId): boolean {
  const filePath = getTrajectoryFilePath(id);
  if (!existsSync(filePath)) {
    return false;
  }

  // Remove JSON file
  unlinkSync(filePath);

  // Update index
  const index = readIndex<TrajectorySummary>(TRAJECTORIES_DIR);
  const filtered = index.filter((t) => t.id !== id);
  writeIndex(TRAJECTORIES_DIR, filtered);

  return true;
}

/**
 * List all trajectories, optionally filtered.
 */
export function listTrajectories(options?: {
  status?: string;
  model?: string;
  limit?: number;
  offset?: number;
}): TrajectorySummary[] {
  let results = readIndex<TrajectorySummary>(TRAJECTORIES_DIR);

  if (options?.status) {
    results = results.filter((t) => t.status === options.status);
  }
  if (options?.model) {
    results = results.filter((t) => t.modelName === options.model);
  }

  // Sort by createdAt descending
  results.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  if (options?.limit) {
    const offset = options.offset || 0;
    results = results.slice(offset, offset + options.limit);
  }

  return results;
}

// ============================================================================
// Task CRUD
// ============================================================================

/**
 * Save a task definition.
 */
export function saveTask(task: TaskDefinition): void {
  initStorage();

  // Write JSON file
  writeJson(getTaskFilePath(task.id), task);

  // Update index
  const index = readIndex<TaskSummary>(TASKS_DIR);
  const summary = {
    id: task.id,
    title: task.title,
    description: task.description,
    successCriteria: task.successCriteria,
    testCommands: task.testCommands,
    tags: task.tags,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  };
  const existing = index.findIndex((t) => t.id === task.id);
  if (existing >= 0) {
    index[existing] = summary;
  } else {
    index.unshift(summary);
  }
  writeIndex(TASKS_DIR, index);
}

/**
 * Load a task by ID.
 */
export function loadTask(id: TaskId): TaskDefinition | null {
  return readJson<TaskDefinition>(getTaskFilePath(id));
}

/**
 * List all tasks.
 */
export function listTasks(): TaskSummary[] {
  let results = readIndex<TaskSummary>(TASKS_DIR);
  results.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return results;
}

/**
 * Delete a task.
 */
export function deleteTask(id: TaskId): boolean {
  const filePath = getTaskFilePath(id);
  if (!existsSync(filePath)) {
    return false;
  }

  unlinkSync(filePath);

  const index = readIndex<TaskSummary>(TASKS_DIR);
  writeIndex(TASKS_DIR, index.filter((t) => t.id !== id));

  return true;
}

/** Summary of a task for list views. */
export interface TaskSummary {
  id: TaskId;
  title: string;
  description: string;
  successCriteria: string[];
  testCommands: string[];
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// Run CRUD
// ============================================================================

/**
 * Save a task run.
 */
export function saveRun(run: TaskRun): void {
  initStorage();

  // Write JSON file
  writeJson(getRunFilePath(run.id), run);

  // Update index
  const index = readIndex<RunSummary>(RUNS_DIR);
  const summary = runToSummary(run);
  const existing = index.findIndex((r) => r.id === run.id);
  if (existing >= 0) {
    index[existing] = summary;
  } else {
    index.unshift(summary);
  }
  writeIndex(RUNS_DIR, index);
}

/**
 * Load a run by ID.
 */
export function loadRun(id: RunId): TaskRun | null {
  return readJson<TaskRun>(getRunFilePath(id));
}

/**
 * List runs, optionally filtered by task.
 */
export function listRuns(taskId?: TaskId): RunSummary[] {
  let results = readIndex<RunSummary>(RUNS_DIR);

  if (taskId) {
    results = results.filter((r) => r.taskId === taskId);
  }

  results.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return results;
}

/** Summary of a run. */
export interface RunSummary {
  id: RunId;
  taskId: TaskId;
  trajectoryId: TrajectoryId;
  modelName: string;
  provider: string;
  status: string;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  score: number;
  createdAt: string;
}

/** Convert a run to a summary. */
function runToSummary(run: TaskRun): RunSummary {
  return {
    id: run.id,
    taskId: run.taskId,
    trajectoryId: run.trajectoryId,
    modelName: run.model.name,
    provider: run.model.provider,
    status: run.status,
    startedAt: run.startedAt,
    endedAt: run.endedAt,
    durationMs: run.durationMs,
    score: 0,
    createdAt: run.startedAt,
  };
}

// ============================================================================
// Leaderboard
// ============================================================================

/**
 * Get leaderboard entries for a task.
 */
export function getLeaderboard(taskId: TaskId): LeaderboardEntry[] {
  const runs = listRuns(taskId);
  const entries: LeaderboardEntry[] = [];

  for (const run of runs) {
    const trajectory = loadTrajectory(run.trajectoryId);
    if (!trajectory) continue;

    // Calculate score based on status and efficiency
    let score = 0;
    if (trajectory.outcome.status === "success") score = 100;
    else if (trajectory.outcome.status === "partial") score = 50;
    else if (trajectory.outcome.status === "failure") score = 0;

    // Bonus for fewer steps and tokens
    const stepBonus = Math.max(0, 20 - trajectory.metadata.stats.totalSteps);
    const tokenEfficiency = trajectory.metadata.stats.tokens.total > 0
      ? Math.max(0, 100 - Math.floor(trajectory.metadata.stats.tokens.total / 1000))
      : 0;

    score = Math.min(100, score + stepBonus * 0.5);

    entries.push({
      runId: run.id,
      taskId: run.taskId,
      modelName: run.modelName,
      status: run.status as any,
      durationMs: run.durationMs,
      steps: trajectory.metadata.stats.totalSteps,
      tokens: trajectory.metadata.stats.tokens.total,
      score: Math.round(score),
      completedAt: run.createdAt,
    });
  }

  // Sort by score descending
  entries.sort((a, b) => b.score - a.score);

  return entries;
}

// ============================================================================
// Import/Export
// ============================================================================

/**
 * Import a trajectory from a JSON string.
 */
export function importTrajectory(json: string): Trajectory {
  const data = JSON.parse(json) as Trajectory;

  // Validate schema version
  if (data.schemaVersion !== TRAJECTORY_SCHEMA_VERSION) {
    console.warn(
      `Trajectory schema version mismatch: expected ${TRAJECTORY_SCHEMA_VERSION}, got ${data.schemaVersion}`
    );
  }

  // Ensure ID exists
  if (!data.id) {
    data.id = uuidv4();
  }

  // Recompute stats
  data.metadata.stats = computeStats(data.steps);

  // Save
  saveTrajectory(data);

  return data;
}

/**
 * Export a trajectory to a JSON string.
 */
export function exportTrajectory(id: TrajectoryId): string {
  const trajectory = loadTrajectory(id);
  if (!trajectory) {
    throw new Error(`Trajectory not found: ${id}`);
  }

  const exportData = {
    trajectory,
    exportVersion: "1.0.0",
    exportedAt: new Date().toISOString(),
  };

  return JSON.stringify(exportData, null, 2);
}

// ============================================================================
// Initialization
// ============================================================================

// Auto-initialize on module load
initStorage();
