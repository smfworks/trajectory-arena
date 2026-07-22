/**
 * Trajectory Arena — Trajectory Schema (v1.0.0)
 *
 * A versioned, extensible schema for recording agentic coding trajectories.
 * Designed to be clean enough that any tool (Hermes, OpenClaw, custom agents)
 * can produce compatible logs.
 *
 * Schema versioning follows semver:
 * - MAJOR: incompatible changes
 * - MINOR: backwards-compatible additions
 * - PATCH: backwards-compatible fixes
 *
 * @see ARCHITECTURE.md for full design rationale
 */

/** Schema version of this trajectory format. */
export const TRAJECTORY_SCHEMA_VERSION = "1.0.0";

/** Unique identifier for a trajectory. */
export type TrajectoryId = string;

/** Unique identifier for a task definition. */
export type TaskId = string;

/** Unique identifier for a single agent run. */
export type RunId = string;

/** Status of a trajectory or task run. */
export type Status = "running" | "success" | "failure" | "partial" | "cancelled";

/**
 * A file specification — used for starter files in task definitions
 * and for describing file operations in trajectory steps.
 */
export interface FileSpec {
  /** Path relative to the working directory. */
  path: string;
  /** File contents. */
  content: string;
  /** MIME type / language for syntax highlighting. */
  language?: string;
}

/**
 * A single diff entry within a file edit operation.
 * Uses the standard unified diff line format.
 */
export interface DiffEntry {
  /** The type of change. */
  type: "add" | "remove" | "context";
  /** The line content (without the leading +/-/space prefix). */
  content: string;
  /** Line number in the new file (for "add" and "context"). */
  newLineNumber?: number;
  /** Line number in the old file (for "remove" and "context"). */
  oldLineNumber?: number;
}

/**
 * The type of a trajectory step — determines which fields in StepData are populated.
 */
export type StepType =
  | "reasoning"
  | "tool_call"
  | "tool_result"
  | "file_edit"
  | "terminal"
  | "test_result"
  | "checkpoint"
  | "message";

/**
 * A single step in a trajectory. Each step has a type and type-specific data.
 * Steps are ordered by stepIndex and timestamp.
 */
export interface TrajectoryStep {
  /** Zero-based index of this step in the trajectory. */
  stepIndex: number;
  /** ISO 8601 timestamp when this step was recorded. */
  timestamp: string;
  /** The type of this step. */
  type: StepType;
  /** Duration of this step in milliseconds (if measurable). */
  durationMs?: number;
  /** Type-specific data for this step. */
  data: StepData;
  /** Optional metadata (e.g., tool name, file path) for quick filtering. */
  meta?: Record<string, unknown>;
}

/**
 * Type-specific data for a trajectory step.
 * Only the field matching the step's `type` should be populated.
 */
export interface StepData {
  /** For stepType "reasoning" — the agent's thinking/reasoning block. */
  reasoning?: {
    /** The full reasoning text. */
    text: string;
  };

  /** For stepType "tool_call" — a tool invocation. */
  toolCall?: {
    /** The name of the tool being called. */
    name: string;
    /** The arguments passed to the tool. */
    arguments: Record<string, unknown>;
    /** Optional ID for matching tool calls to results. */
    toolCallId?: string;
  };

  /** For stepType "tool_result" — the result of a tool call. */
  toolResult?: {
    /** Whether the tool call succeeded. */
    success: boolean;
    /** The output from the tool. */
    output: string;
    /** Error message if the tool call failed. */
    error?: string;
    /** Optional ID matching the originating tool call. */
    toolCallId?: string;
  };

  /** For stepType "file_edit" — a file create/edit/delete operation. */
  fileEdit?: {
    /** Path of the file being edited. */
    filePath: string;
    /** The operation type. */
    operation: "create" | "edit" | "delete";
    /** Content before the edit (for edit/delete). */
    oldContent?: string;
    /** Content after the edit (for create/edit). */
    newContent?: string;
    /** Computed diff entries. */
    diff?: DiffEntry[];
  };

  /** For stepType "terminal" — a terminal command and its output. */
  terminal?: {
    /** The command that was executed. */
    command: string;
    /** The output from the command. */
    output: string;
    /** The exit code of the command. */
    exitCode: number;
  };

  /** For stepType "test_result" — a test or lint result. */
  testResult?: {
    /** Name of the test suite or lint command. */
    testName: string;
    /** The status of the test. */
    status: "pass" | "fail" | "skip";
    /** Output from the test runner. */
    output: string;
    /** Duration of the test in milliseconds. */
    durationMs: number;
  };

  /** For stepType "checkpoint" — a snapshot of the filesystem state. */
  checkpoint?: {
    /** The type of checkpoint. */
    type: "state";
    /** Map of file paths to their contents at this checkpoint. */
    files: Record<string, string>;
  };

  /** For stepType "message" — a plain text message (e.g., user instructions). */
  message?: {
    /** The message text. */
    text: string;
    /** The sender of the message. */
    sender: "user" | "agent" | "system";
  };
}

/**
 * Token usage statistics.
 */
export interface TokenUsage {
  /** Input (prompt) tokens. */
  input: number;
  /** Output (completion) tokens. */
  output: number;
  /** Total tokens (input + output). */
  total: number;
}

/**
 * Statistics about the trajectory.
 */
export interface TrajectoryStats {
  /** Total number of steps. */
  totalSteps: number;
  /** Number of reasoning steps. */
  reasoningSteps: number;
  /** Number of tool calls. */
  toolCalls: number;
  /** Number of file edits. */
  fileEdits: number;
  /** Number of terminal commands. */
  terminalCommands: number;
  /** Number of test results. */
  testResults: number;
  /** List of unique tools used. */
  toolsUsed: string[];
  /** List of files that were modified. */
  filesModified: string[];
  /** Token usage statistics. */
  tokens: TokenUsage;
  /** Total wall-clock duration in milliseconds. */
  durationMs: number;
}

/**
 * Task definition — describes a coding task for the arena.
 */
export interface TaskDefinition {
  /** Unique task identifier. */
  id: TaskId;
  /** Human-readable title. */
  title: string;
  /** Detailed description of the task. */
  description: string;
  /** Success criteria — a list of conditions that must be met. */
  successCriteria: string[];
  /** Starter files provided to the agent. */
  starterFiles: FileSpec[];
  /** Test commands to evaluate the task. */
  testCommands: string[];
  /** Programming language / framework tags. */
  tags: string[];
  /** ISO 8601 timestamp of creation. */
  createdAt: string;
  /** ISO 8601 timestamp of last update. */
  updatedAt: string;
}

/**
 * The outcome of a trajectory.
 */
export interface TrajectoryOutcome {
  /** Final status. */
  status: Status;
  /** Summary of what happened. */
  summary: string;
  /** Test results from the final evaluation. */
  testResults: TestResult[];
}

/**
 * A test result.
 */
export interface TestResult {
  /** Name of the test. */
  name: string;
  /** Status of the test. */
  status: "pass" | "fail" | "skip";
  /** Output from the test runner. */
  output: string;
  /** Duration in milliseconds. */
  durationMs: number;
}

/**
 * Model information.
 */
export interface ModelInfo {
  /** Model name (e.g., "poolside/Laguna-S-2.1-NVFP4"). */
  name: string;
  /** Provider name (e.g., "custom:dgx-spark"). */
  provider: string;
  /** Model configuration. */
  config: Record<string, unknown>;
}

/**
 * Environment information.
 */
export interface EnvironmentInfo {
  /** Operating system. */
  os: string;
  /** Working directory. */
  workingDir: string;
  /** Node.js version. */
  nodeVersion: string;
  /** Timestamp of environment capture. */
  timestamp: string;
}

/**
 * Timing information.
 */
export interface TimingInfo {
  /** ISO 8601 timestamp when the trajectory started. */
  startedAt: string;
  /** ISO 8601 timestamp when the trajectory ended. */
  endedAt: string;
  /** Duration in milliseconds. */
  durationMs: number;
}

/**
 * The complete trajectory metadata.
 */
export interface TrajectoryMetadata {
  /** Task definition (or reference to one). */
  task: TaskDefinition | { id: TaskId };
  /** Model information. */
  model: ModelInfo;
  /** Environment information. */
  environment: EnvironmentInfo;
  /** Timing information. */
  timing: TimingInfo;
  /** Statistics. */
  stats: TrajectoryStats;
}

/**
 * A complete trajectory — the top-level data structure.
 * This is the primary unit of storage and exchange.
 */
export interface Trajectory {
  /** Schema version (semver). */
  schemaVersion: string;
  /** Unique trajectory identifier. */
  id: TrajectoryId;
  /** Run ID (if this trajectory is from a specific run). */
  runId?: RunId;
  /** Metadata about the trajectory. */
  metadata: TrajectoryMetadata;
  /** Ordered list of steps. */
  steps: TrajectoryStep[];
  /** Final outcome. */
  outcome: TrajectoryOutcome;
}

/**
 * A task run — links a task definition to one or more trajectories.
 */
export interface TaskRun {
  /** Run ID. */
  id: RunId;
  /** Task ID. */
  taskId: TaskId;
  /** Trajectory ID produced by this run. */
  trajectoryId: TrajectoryId;
  /** Model used. */
  model: ModelInfo;
  /** Status of the run. */
  status: Status;
  /** When the run started. */
  startedAt: string;
  /** When the run ended. */
  endedAt: string;
  /** Duration in milliseconds. */
  durationMs: number;
  /** Final test results. */
  testResults: TestResult[];
}

/**
 * A leaderboard entry for arena comparison.
 */
export interface LeaderboardEntry {
  /** Run ID. */
  runId: RunId;
  /** Task ID. */
  taskId: TaskId;
  /** Model name. */
  modelName: string;
  /** Status. */
  status: Status;
  /** Duration in milliseconds. */
  durationMs: number;
  /** Number of steps. */
  steps: number;
  /** Token count. */
  tokens: number;
  /** Success score (0-100). */
  score: number;
  /** When the run completed. */
  completedAt: string;
}

/**
 * Import format for trajectories from external sources.
 */
export interface TrajectoryImport {
  /** The trajectory data. */
  trajectory: Trajectory;
  /** Source of the import (e.g., "file", "webhook", "api"). */
  source: string;
}

/**
 * Export format for trajectories.
 */
export interface TrajectoryExport {
  /** The trajectory data. */
  trajectory: Trajectory;
  /** Export format version. */
  exportVersion: string;
  /** When the export was generated. */
  exportedAt: string;
}
