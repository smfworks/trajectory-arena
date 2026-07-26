/**
 * Trajectory Arena — durable local-first JSON storage.
 *
 * Entity files are the source of truth. Lists are derived from validated entity
 * files so a crash cannot leave a mutable index out of sync with persisted data.
 * Every write is validated, written to a same-directory temporary file, fsynced,
 * and atomically renamed into place.
 */

import { randomUUID } from "node:crypto";
import {
  accessSync,
  closeSync,
  constants,
  existsSync,
  fstatSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";
import type {
  LeaderboardEntry,
  RunId,
  Status,
  TaskDefinition,
  TaskId,
  TaskRun,
  TokenUsage,
  Trajectory,
  TrajectoryId,
  TrajectoryStats,
} from "./schema";
import {
  InputValidationError,
  parseEntityId,
  parseTaskDefinition,
  parseTaskRun,
  parseTrajectory,
  parseTrajectoryExport,
} from "./validation";

export type {
  LeaderboardEntry,
  RunId,
  TaskDefinition,
  TaskId,
  TaskRun,
  Trajectory,
  TrajectoryId,
  TrajectoryStats,
} from "./schema";
export { TRAJECTORY_SCHEMA_VERSION } from "./schema";

interface StoragePaths {
  data: string;
  trajectories: string;
  tasks: string;
  runs: string;
}

export class StorageCorruptionError extends Error {
  constructor(path: string, cause: unknown) {
    const detail = cause instanceof Error ? cause.message : "unknown parse error";
    super(`Corrupt JSON storage at ${path}: ${detail}`);
    this.name = "StorageCorruptionError";
    this.cause = cause;
  }
}

export class StorageConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StorageConflictError";
  }
}

export class StorageConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StorageConfigurationError";
  }
}

function getPaths(): StoragePaths {
  const configured = process.env.TRAJECTORY_DATA_DIR?.trim();
  if (process.env.NODE_ENV === "production" && !configured) {
    throw new StorageConfigurationError(
      "TRAJECTORY_DATA_DIR must be an explicit absolute path in production",
    );
  }
  if (configured && !isAbsolute(configured)) {
    throw new StorageConfigurationError("TRAJECTORY_DATA_DIR must be an absolute path");
  }
  const data = configured
    ? resolve(/* turbopackIgnore: true */ configured)
    : join(process.cwd(), "data");
  return {
    data,
    trajectories: join(data, "trajectories"),
    tasks: join(data, "tasks"),
    runs: join(data, "runs"),
  };
}

function ensureStorageDirectories(): void {
  const paths = getPaths();
  for (const directory of [paths.data, paths.trajectories, paths.tasks, paths.runs]) {
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    const stat = lstatSync(directory);
    if (!stat.isDirectory() || stat.isSymbolicLink()) {
      throw new StorageCorruptionError(
        directory,
        new Error("storage directories must not be symbolic links"),
      );
    }
  }
}

export function initStorage(): void {
  ensureStorageDirectories();
  recoverPendingTransactionIfNeeded();
}

export function getDataDir(): string {
  return getPaths().data;
}

function entityPath(directory: string, id: string): string {
  return join(directory, `${parseEntityId(id)}.json`);
}

function atomicWriteText(path: string, serialized: string): void {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const temporary = join(dirname(path), `.${basename(path)}.${process.pid}.${randomUUID()}.tmp`);
  let descriptor: number | undefined;
  let directoryDescriptor: number | undefined;

  try {
    descriptor = openSync(temporary, "wx", 0o600);
    writeFileSync(descriptor, serialized, { encoding: "utf8" });
    fsyncSync(descriptor);
    closeSync(descriptor);
    descriptor = undefined;
    renameSync(temporary, path);
    directoryDescriptor = openSync(dirname(path), constants.O_RDONLY);
    fsyncSync(directoryDescriptor);
    closeSync(directoryDescriptor);
    directoryDescriptor = undefined;
  } catch (error) {
    if (descriptor !== undefined) {
      try {
        closeSync(descriptor);
      } catch {
        // The original write error is more useful than close cleanup failures.
      }
    }
    if (directoryDescriptor !== undefined) {
      try {
        closeSync(directoryDescriptor);
      } catch {
        // Preserve the original error.
      }
    }
    if (existsSync(temporary)) {
      try {
        unlinkSync(temporary);
      } catch {
        // Preserve the original error; orphaned temp files are ignored by readers.
      }
    }
    throw error;
  }
}

function atomicWriteJson(path: string, data: unknown): void {
  atomicWriteText(path, `${JSON.stringify(data, null, 2)}\n`);
}

function readRawFile(path: string): string | null {
  let descriptor: number | undefined;
  try {
    descriptor = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    if (!fstatSync(descriptor).isFile()) {
      throw new StorageCorruptionError(path, new Error("entity path is not a regular file"));
    }
    return readFileSync(descriptor, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    if (error instanceof StorageCorruptionError) throw error;
    if ((error as NodeJS.ErrnoException).code === "ELOOP") {
      throw new StorageCorruptionError(path, new Error("symbolic links are not allowed"));
    }
    throw error;
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

function readValidatedJson<T>(
  path: string,
  parser: (input: unknown) => T,
  expectedId?: string,
): T | null {
  const contents = readRawFile(path);
  if (contents === null) return null;

  try {
    const item = parser(JSON.parse(contents));
    if (
      expectedId !== undefined &&
      (typeof item !== "object" || item === null || !("id" in item) || item.id !== expectedId)
    ) {
      throw new Error(`content ID does not match filename ID ${expectedId}`);
    }
    return item;
  } catch (error) {
    throw new StorageCorruptionError(path, error);
  }
}

function listValidatedJson<T>(directory: string, parser: (input: unknown) => T): T[] {
  initStorage();
  const results: T[] = [];

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) {
      throw new StorageCorruptionError(
        join(directory, entry.name),
        new Error("symbolic links are not allowed in storage collections"),
      );
    }
    if (!entry.isFile() || !entry.name.endsWith(".json") || entry.name === "index.json") {
      continue;
    }
    const id = entry.name.slice(0, -".json".length);
    try {
      parseEntityId(id);
    } catch (error) {
      throw new StorageCorruptionError(join(directory, entry.name), error);
    }
    const item = readValidatedJson(join(directory, entry.name), parser, id);
    if (item) results.push(item);
  }

  return results;
}

function removeEntity(path: string): boolean {
  try {
    unlinkSync(path);
    const directoryDescriptor = openSync(dirname(path), constants.O_RDONLY);
    try {
      fsyncSync(directoryDescriptor);
    } finally {
      closeSync(directoryDescriptor);
    }
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

interface StorageSnapshot {
  path: string;
  contents: string | null;
}

let inProcessLockDepth = 0;
const LEGACY_WRITE_LOCK_MAX_AGE_MS = 5 * 60 * 1_000;
const INCOMPLETE_LOCK_GRACE_MS = 30_000;

interface LockMetadata {
  pid: number;
  processStartTime?: string;
  token: string;
  createdAt: string;
}

function processExists(pid: number): boolean {
  if (!Number.isSafeInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

function processStartTimeFor(pid: number): string | null {
  if (process.platform !== "linux" || !Number.isSafeInteger(pid) || pid <= 0) return null;
  try {
    const stat = readFileSync(`/proc/${pid}/stat`, "utf8");
    const fields = stat.slice(stat.lastIndexOf(")") + 2).split(" ");
    return fields[19] || null;
  } catch {
    return null;
  }
}

function currentLockMetadata(): LockMetadata {
  return {
    pid: process.pid,
    ...(processStartTimeFor(process.pid)
      ? { processStartTime: processStartTimeFor(process.pid) ?? undefined }
      : {}),
    token: randomUUID(),
    createdAt: new Date().toISOString(),
  };
}

function parseLockMetadata(contents: string): LockMetadata | null {
  try {
    const value = JSON.parse(contents) as Partial<LockMetadata>;
    if (
      !Number.isSafeInteger(value.pid) ||
      typeof value.token !== "string" ||
      value.token.length === 0 ||
      typeof value.createdAt !== "string"
    ) {
      return null;
    }
    if (value.processStartTime !== undefined && typeof value.processStartTime !== "string") {
      return null;
    }
    return value as LockMetadata;
  } catch {
    return null;
  }
}

function lockOwnerIsLive(lockPath: string, contents: string): boolean {
  const lock = parseLockMetadata(contents);
  if (!lock) return Date.now() - statSync(lockPath).mtimeMs < INCOMPLETE_LOCK_GRACE_MS;
  if (!processExists(lock.pid)) return false;

  const observedStartTime = processStartTimeFor(lock.pid);
  if (lock.processStartTime && observedStartTime) {
    return lock.processStartTime === observedStartTime;
  }

  const createdAt = Date.parse(lock.createdAt);
  const lockAge = Number.isFinite(createdAt)
    ? Date.now() - createdAt
    : Date.now() - statSync(lockPath).mtimeMs;
  return lockAge <= LEGACY_WRITE_LOCK_MAX_AGE_MS;
}

function createOwnedLock(path: string): LockMetadata {
  const metadata = currentLockMetadata();
  let descriptor: number | undefined;
  let created = false;
  try {
    descriptor = openSync(path, "wx", 0o600);
    created = true;
    writeFileSync(descriptor, `${JSON.stringify(metadata)}\n`, "utf8");
    fsyncSync(descriptor);
    closeSync(descriptor);
    descriptor = undefined;
    return metadata;
  } catch (error) {
    if (descriptor !== undefined) {
      try {
        closeSync(descriptor);
      } catch {
        // Preserve the acquisition error.
      }
    }
    if (created) {
      try {
        unlinkSync(path);
      } catch (cleanupError) {
        throw new AggregateError([error, cleanupError], "Lock creation and cleanup both failed");
      }
    }
    throw error;
  }
}

function releaseOwnedLock(path: string, token: string): void {
  const contents = readRawFile(path);
  const current = contents === null ? null : parseLockMetadata(contents);
  if (!current || current.token !== token) {
    throw new StorageConflictError("Storage write-lock ownership changed unexpectedly");
  }
  if (!removeEntity(path)) {
    throw new StorageConflictError("Storage write lock disappeared before release");
  }
}

function tryAcquireReclaimGuard(path: string): LockMetadata | null {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return createOwnedLock(path);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      const contents = readRawFile(path);
      if (contents === null) continue;
      if (attempt === 0 && !lockOwnerIsLive(path, contents)) {
        try {
          unlinkSync(path);
          continue;
        } catch (unlinkError) {
          if ((unlinkError as NodeJS.ErrnoException).code === "ENOENT") continue;
          throw unlinkError;
        }
      }
      return null;
    }
  }
  return null;
}

function removeStaleLock(lockPath: string): boolean {
  const reclaimPath = `${lockPath}.reclaim`;
  const reclaim = tryAcquireReclaimGuard(reclaimPath);
  if (!reclaim) return false;

  let result = false;
  let operationError: unknown;
  try {
    const contents = readRawFile(lockPath);
    if (contents === null) {
      result = true;
    } else if (!lockOwnerIsLive(lockPath, contents)) {
      try {
        unlinkSync(lockPath);
        result = true;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") result = true;
        else throw error;
      }
    }
  } catch (error) {
    operationError = error;
  }

  let cleanupError: unknown;
  try {
    releaseOwnedLock(reclaimPath, reclaim.token);
  } catch (error) {
    cleanupError = error;
  }
  if (operationError !== undefined && cleanupError !== undefined) {
    throw new AggregateError(
      [operationError, cleanupError],
      "Lock reclaim and cleanup both failed",
    );
  }
  if (operationError !== undefined) throw operationError;
  if (cleanupError !== undefined) throw cleanupError;
  return result;
}

function withStorageLock<T>(operation: () => T): T {
  if (inProcessLockDepth > 0) return operation();
  ensureStorageDirectories();
  const lockPath = join(getPaths().data, ".write.lock");
  let lock: LockMetadata | null = null;

  for (let attempt = 0; attempt < 2 && !lock; attempt += 1) {
    try {
      lock = createOwnedLock(lockPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      if (!removeStaleLock(lockPath)) {
        throw new StorageConflictError("Storage is busy with another writer");
      }
    }
  }

  if (!lock) throw new StorageConflictError("Could not acquire storage write lock");
  inProcessLockDepth += 1;
  let result!: T;
  let operationError: unknown;
  try {
    recoverPendingTransaction();
    result = operation();
  } catch (error) {
    operationError = error;
  }
  inProcessLockDepth -= 1;

  let cleanupError: unknown;
  try {
    releaseOwnedLock(lockPath, lock.token);
  } catch (error) {
    cleanupError = error;
  }

  if (operationError !== undefined && cleanupError !== undefined) {
    throw new AggregateError(
      [operationError, cleanupError],
      "Storage operation and lock cleanup both failed",
    );
  }
  if (operationError !== undefined) throw operationError;
  if (cleanupError !== undefined) throw cleanupError;
  return result;
}

type StorageCollection = "tasks" | "trajectories" | "runs";

interface JournalSnapshot {
  collection: StorageCollection;
  id: string;
  contents: string | null;
}

interface TransactionJournal {
  version: 1;
  snapshots: JournalSnapshot[];
}

function transactionJournalPath(): string {
  return join(getPaths().data, ".transaction.json");
}

function pathForJournalSnapshot(snapshot: JournalSnapshot): string {
  const paths = getPaths();
  return entityPath(paths[snapshot.collection], snapshot.id);
}

function journalSnapshotFor(snapshot: StorageSnapshot): JournalSnapshot {
  const paths = getPaths();
  for (const collection of ["tasks", "trajectories", "runs"] as const) {
    const directory = paths[collection];
    if (dirname(snapshot.path) !== directory || !basename(snapshot.path).endsWith(".json"))
      continue;
    const id = parseEntityId(basename(snapshot.path).slice(0, -".json".length));
    if (entityPath(directory, id) !== snapshot.path) break;
    return { collection, id, contents: snapshot.contents };
  }
  throw new StorageCorruptionError(snapshot.path, new Error("transaction path is outside storage"));
}

function parseTransactionJournal(contents: string): TransactionJournal {
  try {
    const decoded = JSON.parse(contents) as {
      version?: unknown;
      snapshots?: unknown;
    };
    if (decoded.version !== 1 || !Array.isArray(decoded.snapshots))
      throw new Error("invalid journal");
    const snapshots = decoded.snapshots.map((value) => {
      if (typeof value !== "object" || value === null) throw new Error("invalid snapshot");
      const snapshot = value as Record<string, unknown>;
      if (
        !["tasks", "trajectories", "runs"].includes(String(snapshot.collection)) ||
        (snapshot.contents !== null && typeof snapshot.contents !== "string")
      ) {
        throw new Error("invalid snapshot fields");
      }
      return {
        collection: snapshot.collection as StorageCollection,
        id: parseEntityId(snapshot.id),
        contents: snapshot.contents as string | null,
      };
    });
    return { version: 1, snapshots };
  } catch (error) {
    throw new StorageCorruptionError(transactionJournalPath(), error);
  }
}

function recoverPendingTransaction(): void {
  const journalPath = transactionJournalPath();
  const contents = readRawFile(journalPath);
  if (contents === null) return;
  const journal = parseTransactionJournal(contents);
  const snapshots = journal.snapshots.map((snapshot) => ({
    path: pathForJournalSnapshot(snapshot),
    contents: snapshot.contents,
  }));
  restoreSnapshots(snapshots);
  if (!removeEntity(journalPath)) {
    throw new StorageCorruptionError(journalPath, new Error("transaction journal disappeared"));
  }
}

function recoverPendingTransactionIfNeeded(): void {
  if (readRawFile(transactionJournalPath()) === null) return;
  if (inProcessLockDepth > 0) {
    recoverPendingTransaction();
    return;
  }
  withStorageLock(() => {
    recoverPendingTransaction();
  });
}

function restoreSnapshots(snapshots: readonly StorageSnapshot[]): void {
  for (const snapshot of [...snapshots].reverse()) {
    if (snapshot.contents === null) {
      removeEntity(snapshot.path);
    } else {
      atomicWriteText(snapshot.path, snapshot.contents);
    }
  }
}

function transactionalApply(
  entries: ReadonlyArray<{ path: string; data: unknown }>,
  removals: readonly string[],
): void {
  withStorageLock(() => {
    const affectedPaths = [...new Set([...entries.map((entry) => entry.path), ...removals])];
    const snapshots = affectedPaths.map((path) => ({ path, contents: readRawFile(path) }));
    const journal: TransactionJournal = {
      version: 1,
      snapshots: snapshots.map(journalSnapshotFor),
    };
    const journalPath = transactionJournalPath();
    atomicWriteJson(journalPath, journal);
    try {
      for (const path of removals) removeEntity(path);
      for (const entry of entries) atomicWriteJson(entry.path, entry.data);
      if (!removeEntity(journalPath)) throw new Error("transaction journal disappeared");
    } catch (error) {
      try {
        restoreSnapshots(snapshots);
        removeEntity(journalPath);
      } catch (rollbackError) {
        throw new AggregateError(
          [error, rollbackError],
          "Storage transaction and rollback both failed",
        );
      }
      throw error;
    }
  });
}

function transactionalWrite(entries: ReadonlyArray<{ path: string; data: unknown }>): void {
  transactionalApply(entries, []);
}

function transactionalRemove(paths: readonly string[]): void {
  transactionalApply([], paths);
}

export function computeStats(
  steps: Trajectory["steps"],
  preserved?: { tokens: TokenUsage; durationMs: number },
): TrajectoryStats {
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
        reasoningSteps += 1;
        break;
      case "tool_call":
        toolCalls += 1;
        if (step.data.toolCall) toolsUsed.add(step.data.toolCall.name);
        break;
      case "file_edit":
        fileEdits += 1;
        if (step.data.fileEdit) filesModified.add(step.data.fileEdit.filePath);
        break;
      case "terminal":
        terminalCommands += 1;
        break;
      case "test_result":
        testResults += 1;
        break;
      default:
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
    toolsUsed: [...toolsUsed].sort(),
    filesModified: [...filesModified].sort(),
    tokens: preserved?.tokens ?? { input: 0, output: 0, total: 0 },
    durationMs: preserved?.durationMs ?? 0,
  };
}

export function normalizeTrajectory(input: unknown): Trajectory {
  const trajectory = parseTrajectory(input);
  const stats = computeStats(trajectory.steps, {
    tokens: trajectory.metadata.stats.tokens,
    durationMs: trajectory.metadata.timing.durationMs,
  });
  return {
    ...trajectory,
    metadata: {
      ...trajectory.metadata,
      stats,
    },
  };
}

function runFromTrajectory(trajectory: Trajectory): TaskRun | null {
  if (!trajectory.runId) return null;
  return parseTaskRun({
    id: trajectory.runId,
    taskId: trajectory.metadata.task.id,
    trajectoryId: trajectory.id,
    model: trajectory.metadata.model,
    status: trajectory.outcome.status,
    startedAt: trajectory.metadata.timing.startedAt,
    endedAt: trajectory.metadata.timing.endedAt,
    durationMs: trajectory.metadata.timing.durationMs,
    testResults: trajectory.outcome.testResults,
  });
}

export interface TrajectorySummary {
  id: TrajectoryId;
  runId: RunId | null;
  title: string;
  description: string;
  modelName: string;
  provider: string;
  status: Status;
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

function trajectoryToSummary(trajectory: Trajectory): TrajectorySummary {
  return {
    id: trajectory.id,
    runId: trajectory.runId ?? null,
    title: trajectory.metadata.task.title,
    description: trajectory.metadata.task.description,
    modelName: trajectory.metadata.model.name,
    provider: trajectory.metadata.model.provider,
    status: trajectory.outcome.status,
    startedAt: trajectory.metadata.timing.startedAt,
    endedAt: trajectory.metadata.timing.endedAt,
    durationMs: trajectory.metadata.timing.durationMs,
    stepsCount: trajectory.metadata.stats.totalSteps,
    tokensInput: trajectory.metadata.stats.tokens.input,
    tokensOutput: trajectory.metadata.stats.tokens.output,
    tokensTotal: trajectory.metadata.stats.tokens.total,
    createdAt: trajectory.metadata.timing.startedAt,
    updatedAt: trajectory.metadata.timing.endedAt,
  };
}

function trajectoryGraphEntries(trajectory: Trajectory): Array<{ path: string; data: unknown }> {
  const task = parseTaskDefinition(trajectory.metadata.task);
  const run = runFromTrajectory(trajectory);
  const paths = getPaths();
  return [
    { path: entityPath(paths.tasks, task.id), data: task },
    { path: entityPath(paths.trajectories, trajectory.id), data: trajectory },
    ...(run ? [{ path: entityPath(paths.runs, run.id), data: run }] : []),
  ];
}

export function saveTrajectories(inputs: readonly Trajectory[]): void {
  const trajectories = inputs.map(normalizeTrajectory);
  const entriesByPath = new Map<string, { path: string; data: unknown }>();
  const tasksById = new Map<string, TaskDefinition>();
  const runsById = new Map<string, TaskRun>();
  const trajectoryIds = new Set<string>();

  for (const trajectory of trajectories) {
    if (trajectoryIds.has(trajectory.id)) {
      throw new StorageConflictError(`Duplicate trajectory ID in batch: ${trajectory.id}`);
    }
    trajectoryIds.add(trajectory.id);

    const task = parseTaskDefinition(trajectory.metadata.task);
    const previousTask = tasksById.get(task.id);
    if (previousTask && JSON.stringify(previousTask) !== JSON.stringify(task)) {
      throw new StorageConflictError(`Conflicting task definitions for ${task.id}`);
    }
    tasksById.set(task.id, task);

    const run = runFromTrajectory(trajectory);
    if (run) {
      const previousRun = runsById.get(run.id);
      if (previousRun && previousRun.trajectoryId !== run.trajectoryId) {
        throw new StorageConflictError(`Run ${run.id} belongs to another trajectory`);
      }
      runsById.set(run.id, run);
    }

    for (const entry of trajectoryGraphEntries(trajectory)) entriesByPath.set(entry.path, entry);
  }

  withStorageLock(() => {
    for (const task of tasksById.values()) {
      const existing = loadTask(task.id);
      if (existing && JSON.stringify(existing) !== JSON.stringify(task)) {
        throw new StorageConflictError(`Conflicting task definition for ${task.id}`);
      }
    }
    for (const run of runsById.values()) {
      const existing = loadRun(run.id);
      if (existing && existing.trajectoryId !== run.trajectoryId) {
        throw new StorageConflictError(`Run ${run.id} belongs to another trajectory`);
      }
    }

    const paths = getPaths();
    const replacementIds = new Set(trajectories.map((trajectory) => trajectory.id));
    const retainedRunIds = new Set(runsById.keys());
    const obsoleteRuns = listRuns()
      .filter((run) => replacementIds.has(run.trajectoryId) && !retainedRunIds.has(run.id))
      .map((run) => entityPath(paths.runs, run.id));
    transactionalApply([...entriesByPath.values()], obsoleteRuns);
  });
}

export function saveTrajectory(input: Trajectory): void {
  saveTrajectories([input]);
}

export function loadTrajectory(id: TrajectoryId): Trajectory | null {
  initStorage();
  const validatedId = parseEntityId(id);
  return readValidatedJson(
    entityPath(getPaths().trajectories, validatedId),
    parseTrajectory,
    validatedId,
  );
}

export function deleteTrajectory(id: TrajectoryId): boolean {
  const validatedId = parseEntityId(id);
  return withStorageLock(() => {
    const paths = getPaths();
    const trajectoryPath = entityPath(paths.trajectories, validatedId);
    if (loadTrajectory(validatedId) === null) return false;
    const references = listRuns().filter((run) => run.trajectoryId === validatedId);
    transactionalRemove([
      ...references.map((run) => entityPath(paths.runs, run.id)),
      trajectoryPath,
    ]);
    return true;
  });
}

export function listTrajectories(options?: {
  status?: Status;
  model?: string;
  limit?: number;
  offset?: number;
}): TrajectorySummary[] {
  let results = listValidatedJson(getPaths().trajectories, parseTrajectory)
    .map(trajectoryToSummary)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));

  if (options?.status) results = results.filter((item) => item.status === options.status);
  if (options?.model) results = results.filter((item) => item.modelName === options.model);

  const offset = options?.offset ?? 0;
  const end = options?.limit === undefined ? undefined : offset + options.limit;
  return results.slice(offset, end);
}

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

function taskToSummary(task: TaskDefinition): TaskSummary {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    successCriteria: task.successCriteria,
    testCommands: task.testCommands,
    tags: task.tags,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  };
}

export function saveTask(input: TaskDefinition): void {
  const task = parseTaskDefinition(input);
  withStorageLock(() => {
    const paths = getPaths();
    const embeddedTasks = listValidatedJson(paths.trajectories, parseTrajectory)
      .filter((trajectory) => trajectory.metadata.task.id === task.id)
      .map((trajectory) => trajectory.metadata.task);
    if (embeddedTasks.some((embedded) => JSON.stringify(embedded) !== JSON.stringify(task))) {
      throw new StorageConflictError(
        `Task ${task.id} is referenced by a trajectory with a different contract`,
      );
    }
    transactionalWrite([{ path: entityPath(paths.tasks, task.id), data: task }]);
  });
}

export function loadTask(id: TaskId): TaskDefinition | null {
  initStorage();
  const validatedId = parseEntityId(id);
  return readValidatedJson(
    entityPath(getPaths().tasks, validatedId),
    parseTaskDefinition,
    validatedId,
  );
}

export function listTasks(): TaskSummary[] {
  return listValidatedJson(getPaths().tasks, parseTaskDefinition)
    .map(taskToSummary)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export function deleteTask(id: TaskId): boolean {
  const validatedId = parseEntityId(id);
  return withStorageLock(() => {
    const paths = getPaths();
    const runReferences = listRuns(validatedId);
    const trajectoryReferences = listValidatedJson(paths.trajectories, parseTrajectory).filter(
      (trajectory) => trajectory.metadata.task.id === validatedId,
    );
    if (runReferences.length > 0 || trajectoryReferences.length > 0) {
      throw new StorageConflictError(
        `Task ${validatedId} is referenced by ${trajectoryReferences.length} trajectory(ies) and ${runReferences.length} run(s)`,
      );
    }
    return removeEntity(entityPath(paths.tasks, validatedId));
  });
}

export interface RunSummary {
  id: RunId;
  taskId: TaskId;
  trajectoryId: TrajectoryId;
  modelName: string;
  provider: string;
  status: Status;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  score: number;
  createdAt: string;
}

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
    score: scoreForStatus(run.status),
    createdAt: run.startedAt,
  };
}

export function saveRun(input: TaskRun): void {
  const run = parseTaskRun(input);
  withStorageLock(() => {
    const task = loadTask(run.taskId);
    const trajectory = loadTrajectory(run.trajectoryId);
    if (!task) throw new StorageConflictError(`Run references missing task ${run.taskId}`);
    if (!trajectory) {
      throw new StorageConflictError(`Run references missing trajectory ${run.trajectoryId}`);
    }
    if (trajectory.metadata.task.id !== task.id) {
      throw new StorageConflictError("Run task does not match the trajectory task");
    }
    const expectedRun = runFromTrajectory(trajectory);
    if (!expectedRun) {
      throw new StorageConflictError("Trajectory does not declare a run");
    }
    if (JSON.stringify(run) !== JSON.stringify(expectedRun)) {
      throw new StorageConflictError("Run does not exactly match the trajectory-declared run");
    }
    transactionalWrite([{ path: entityPath(getPaths().runs, run.id), data: run }]);
  });
}

export function loadRun(id: RunId): TaskRun | null {
  initStorage();
  const validatedId = parseEntityId(id);
  return readValidatedJson(entityPath(getPaths().runs, validatedId), parseTaskRun, validatedId);
}

export function listRuns(taskId?: TaskId): RunSummary[] {
  const validatedTaskId = taskId === undefined ? undefined : parseEntityId(taskId);
  return listValidatedJson(getPaths().runs, parseTaskRun)
    .filter((run) => validatedTaskId === undefined || run.taskId === validatedTaskId)
    .map(runToSummary)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

function scoreForStatus(status: Status): number {
  if (status === "success") return 100;
  if (status === "partial") return 50;
  return 0;
}

export function getLeaderboard(taskId: TaskId): LeaderboardEntry[] {
  const entries = listRuns(parseEntityId(taskId)).flatMap((run) => {
    const trajectory = loadTrajectory(run.trajectoryId);
    if (!trajectory) return [];
    const status = trajectory.outcome.status;
    return [
      {
        runId: run.id,
        taskId: run.taskId,
        trajectoryId: run.trajectoryId,
        modelName: run.modelName,
        status,
        durationMs: run.durationMs,
        steps: trajectory.metadata.stats.totalSteps,
        tokens: trajectory.metadata.stats.tokens.total,
        score: scoreForStatus(status),
        completedAt: run.endedAt,
      },
    ];
  });

  return entries.sort(
    (left, right) =>
      right.score - left.score ||
      left.durationMs - right.durationMs ||
      left.tokens - right.tokens ||
      left.steps - right.steps ||
      left.modelName.localeCompare(right.modelName),
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function importTrajectory(json: string): Trajectory {
  let decoded: unknown;
  try {
    decoded = JSON.parse(json);
  } catch (error) {
    throw new InputValidationError("Invalid JSON", [
      error instanceof Error ? error.message : "parse failed",
    ]);
  }

  if (isRecord(decoded) && "trajectory" in decoded) {
    decoded = parseTrajectoryExport(decoded).trajectory;
  }
  if (isRecord(decoded) && !("id" in decoded)) {
    decoded = { ...decoded, id: randomUUID() };
  }

  const trajectory = normalizeTrajectory(decoded);
  saveTrajectory(trajectory);
  return trajectory;
}

export function exportTrajectory(id: TrajectoryId): string {
  const trajectory = loadTrajectory(id);
  if (!trajectory) throw new Error(`Trajectory not found: ${parseEntityId(id)}`);
  return JSON.stringify(
    {
      trajectory,
      exportVersion: "1.0.0",
      exportedAt: new Date().toISOString(),
    },
    null,
    2,
  );
}

function assertStorageGraphIntegrity(
  paths: StoragePaths,
  trajectories: readonly Trajectory[],
  tasks: readonly TaskDefinition[],
  runs: readonly TaskRun[],
): void {
  const corruption = (message: string) =>
    new StorageCorruptionError(paths.data, new Error(message));
  const trajectoriesById = new Map(trajectories.map((trajectory) => [trajectory.id, trajectory]));
  const tasksById = new Map(tasks.map((task) => [task.id, task]));
  const runsById = new Map(runs.map((run) => [run.id, run]));

  if (trajectoriesById.size !== trajectories.length) {
    throw corruption("duplicate trajectory IDs");
  }
  if (tasksById.size !== tasks.length) throw corruption("duplicate task IDs");
  if (runsById.size !== runs.length) throw corruption("duplicate run IDs");

  for (const trajectory of trajectories) {
    const task = tasksById.get(trajectory.metadata.task.id);
    if (!task) {
      throw corruption(
        `trajectory ${trajectory.id} references missing task ${trajectory.metadata.task.id}`,
      );
    }
    if (JSON.stringify(task) !== JSON.stringify(trajectory.metadata.task)) {
      throw corruption(`trajectory ${trajectory.id} embeds a conflicting task contract`);
    }

    const expectedRun = runFromTrajectory(trajectory);
    if (!expectedRun) continue;
    const run = runsById.get(expectedRun.id);
    if (!run) {
      throw corruption(`trajectory ${trajectory.id} references missing run ${expectedRun.id}`);
    }
    if (JSON.stringify(run) !== JSON.stringify(expectedRun)) {
      throw corruption(`run ${expectedRun.id} does not match trajectory ${trajectory.id}`);
    }
  }

  for (const run of runs) {
    const trajectory = trajectoriesById.get(run.trajectoryId);
    if (!trajectory) {
      throw corruption(`run ${run.id} references missing trajectory ${run.trajectoryId}`);
    }
    if (!tasksById.has(run.taskId)) {
      throw corruption(`run ${run.id} references missing task ${run.taskId}`);
    }
    if (trajectory.runId !== run.id) {
      throw corruption(`run ${run.id} is not the declared run for trajectory ${trajectory.id}`);
    }
    if (trajectory.metadata.task.id !== run.taskId) {
      throw corruption(`run ${run.id} task does not match trajectory ${trajectory.id}`);
    }
  }
}

export function getStorageHealth(): {
  writable: boolean;
  trajectories: number;
  tasks: number;
  runs: number;
} {
  initStorage();
  const paths = getPaths();
  const writable = process.env.TRAJECTORY_READ_ONLY?.toLowerCase() !== "true";
  const requiredAccess = constants.R_OK | constants.X_OK | (writable ? constants.W_OK : 0);
  for (const directory of [paths.data, paths.trajectories, paths.tasks, paths.runs]) {
    accessSync(directory, requiredAccess);
  }

  const trajectories = listValidatedJson(paths.trajectories, parseTrajectory);
  const tasks = listValidatedJson(paths.tasks, parseTaskDefinition);
  const runs = listValidatedJson(paths.runs, parseTaskRun);
  assertStorageGraphIntegrity(paths, trajectories, tasks, runs);

  return {
    writable,
    trajectories: trajectories.length,
    tasks: tasks.length,
    runs: runs.length,
  };
}
