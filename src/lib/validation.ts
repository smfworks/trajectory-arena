import { z } from "zod";
import type { Status, TaskDefinition, TaskRun, Trajectory, TrajectoryExport } from "./schema";
import { TRAJECTORY_SCHEMA_VERSION } from "./schema";

export const MAX_ENTITY_ID_LENGTH = 128;
export const MAX_REQUEST_BYTES = 10 * 1024 * 1024;
export const MAX_LIST_LIMIT = 100;

const MAX_SHORT_TEXT = 1_000;
const MAX_LONG_TEXT = 2_000_000;
const MAX_COLLECTION = 100_000;

const entityIdSchema = z
  .string()
  .min(1)
  .max(MAX_ENTITY_ID_LENGTH)
  .regex(
    /^[A-Za-z0-9][A-Za-z0-9_-]*$/,
    "must contain only letters, numbers, underscores, and hyphens",
  );
const isoTimestampSchema = z.string().datetime({ offset: true });
const finiteNonNegativeSchema = z.number().finite().nonnegative();
const finiteNonNegativeIntegerSchema = z.number().int().nonnegative();
const shortTextSchema = z.string().max(MAX_SHORT_TEXT);
const requiredShortTextSchema = z.string().trim().min(1).max(MAX_SHORT_TEXT);
const longTextSchema = z.string().max(MAX_LONG_TEXT);
const filePathSchema = z
  .string()
  .trim()
  .min(1)
  .max(4_096)
  .refine((value) => !value.includes("\0"), "must not contain null bytes");
const jsonRecordSchema = z.record(z.string().max(256), z.json());
const statusSchema = z.enum(["running", "success", "failure", "partial", "cancelled"]);
const testStatusSchema = z.enum(["pass", "fail", "skip"]);

const fileSpecSchema = z
  .object({
    path: filePathSchema,
    content: longTextSchema,
    language: z.string().trim().max(100).optional(),
  })
  .strict();

const diffEntrySchema = z
  .object({
    type: z.enum(["add", "remove", "context"]),
    content: longTextSchema,
    newLineNumber: z.number().int().positive().optional(),
    oldLineNumber: z.number().int().positive().optional(),
  })
  .strict();

const stepBase = {
  stepIndex: finiteNonNegativeIntegerSchema.max(MAX_COLLECTION),
  timestamp: isoTimestampSchema,
  durationMs: finiteNonNegativeSchema.optional(),
  meta: jsonRecordSchema.optional(),
};

const trajectoryStepSchema = z.discriminatedUnion("type", [
  z
    .object({
      ...stepBase,
      type: z.literal("reasoning"),
      data: z.object({ reasoning: z.object({ text: longTextSchema }).strict() }).strict(),
    })
    .strict(),
  z
    .object({
      ...stepBase,
      type: z.literal("tool_call"),
      data: z
        .object({
          toolCall: z
            .object({
              name: requiredShortTextSchema,
              arguments: jsonRecordSchema,
              toolCallId: z.string().max(256).optional(),
            })
            .strict(),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      ...stepBase,
      type: z.literal("tool_result"),
      data: z
        .object({
          toolResult: z
            .object({
              success: z.boolean(),
              output: longTextSchema,
              error: longTextSchema.optional(),
              toolCallId: z.string().max(256).optional(),
            })
            .strict(),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      ...stepBase,
      type: z.literal("file_edit"),
      data: z
        .object({
          fileEdit: z
            .object({
              filePath: filePathSchema,
              operation: z.enum(["create", "edit", "delete"]),
              oldContent: longTextSchema.optional(),
              newContent: longTextSchema.optional(),
              diff: z.array(diffEntrySchema).max(MAX_COLLECTION).optional(),
            })
            .strict()
            .superRefine((edit, context) => {
              if (edit.operation === "create" && edit.newContent === undefined) {
                context.addIssue({
                  code: "custom",
                  path: ["newContent"],
                  message: "create requires newContent",
                });
              }
              if (edit.operation === "delete" && edit.oldContent === undefined) {
                context.addIssue({
                  code: "custom",
                  path: ["oldContent"],
                  message: "delete requires oldContent",
                });
              }
            }),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      ...stepBase,
      type: z.literal("terminal"),
      data: z
        .object({
          terminal: z
            .object({
              command: longTextSchema,
              output: longTextSchema,
              exitCode: z.number().int(),
            })
            .strict(),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      ...stepBase,
      type: z.literal("test_result"),
      data: z
        .object({
          testResult: z
            .object({
              testName: requiredShortTextSchema,
              status: testStatusSchema,
              output: longTextSchema,
              durationMs: finiteNonNegativeSchema,
            })
            .strict(),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      ...stepBase,
      type: z.literal("checkpoint"),
      data: z
        .object({
          checkpoint: z
            .object({
              type: z.literal("state"),
              files: z.record(filePathSchema, longTextSchema),
            })
            .strict(),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      ...stepBase,
      type: z.literal("message"),
      data: z
        .object({
          message: z
            .object({
              text: longTextSchema,
              sender: z.enum(["user", "agent", "system"]),
            })
            .strict(),
        })
        .strict(),
    })
    .strict(),
]);

const taskDefinitionSchema = z
  .object({
    id: entityIdSchema,
    title: requiredShortTextSchema,
    description: longTextSchema,
    successCriteria: z.array(requiredShortTextSchema).max(1_000),
    starterFiles: z.array(fileSpecSchema).max(1_000),
    testCommands: z.array(requiredShortTextSchema).max(1_000),
    tags: z.array(z.string().trim().min(1).max(100)).max(1_000),
    createdAt: isoTimestampSchema,
    updatedAt: isoTimestampSchema,
  })
  .strict();

const testResultSchema = z
  .object({
    name: requiredShortTextSchema,
    status: testStatusSchema,
    output: longTextSchema,
    durationMs: finiteNonNegativeSchema,
  })
  .strict();

const modelInfoSchema = z
  .object({
    name: requiredShortTextSchema,
    provider: requiredShortTextSchema,
    config: jsonRecordSchema,
  })
  .strict();

const tokenUsageSchema = z
  .object({
    input: finiteNonNegativeIntegerSchema,
    output: finiteNonNegativeIntegerSchema,
    total: finiteNonNegativeIntegerSchema,
  })
  .strict()
  .refine((tokens) => tokens.total === tokens.input + tokens.output, {
    path: ["total"],
    message: "must equal input + output",
  });

const trajectoryStatsSchema = z
  .object({
    totalSteps: finiteNonNegativeIntegerSchema,
    reasoningSteps: finiteNonNegativeIntegerSchema,
    toolCalls: finiteNonNegativeIntegerSchema,
    fileEdits: finiteNonNegativeIntegerSchema,
    terminalCommands: finiteNonNegativeIntegerSchema,
    testResults: finiteNonNegativeIntegerSchema,
    toolsUsed: z.array(shortTextSchema).max(MAX_COLLECTION),
    filesModified: z.array(filePathSchema).max(MAX_COLLECTION),
    tokens: tokenUsageSchema,
    durationMs: finiteNonNegativeSchema,
  })
  .strict();

const trajectorySchema = z
  .object({
    schemaVersion: z.literal(TRAJECTORY_SCHEMA_VERSION),
    id: entityIdSchema,
    runId: entityIdSchema.optional(),
    metadata: z
      .object({
        task: taskDefinitionSchema,
        model: modelInfoSchema,
        environment: z
          .object({
            os: shortTextSchema,
            workingDir: z.string().max(4_096),
            nodeVersion: shortTextSchema,
            timestamp: isoTimestampSchema,
          })
          .strict(),
        timing: z
          .object({
            startedAt: isoTimestampSchema,
            endedAt: isoTimestampSchema,
            durationMs: finiteNonNegativeSchema,
          })
          .strict()
          .superRefine((timing, context) => {
            const elapsed = Date.parse(timing.endedAt) - Date.parse(timing.startedAt);
            if (elapsed < 0) {
              context.addIssue({
                code: "custom",
                path: ["endedAt"],
                message: "must not precede startedAt",
              });
            }
            if (timing.durationMs !== elapsed) {
              context.addIssue({
                code: "custom",
                path: ["durationMs"],
                message: `must equal the timestamp interval (${elapsed}ms)`,
              });
            }
          }),
        stats: trajectoryStatsSchema,
      })
      .strict(),
    steps: z.array(trajectoryStepSchema).max(MAX_COLLECTION),
    outcome: z
      .object({
        status: statusSchema,
        summary: longTextSchema,
        testResults: z.array(testResultSchema).max(MAX_COLLECTION),
      })
      .strict(),
  })
  .strict()
  .superRefine((trajectory, context) => {
    trajectory.steps.forEach((step, index) => {
      if (step.stepIndex !== index) {
        context.addIssue({
          code: "custom",
          path: ["steps", index, "stepIndex"],
          message: `stepIndex must be contiguous and equal ${index}`,
        });
      }
    });
  });

const taskRunSchema = z
  .object({
    id: entityIdSchema,
    taskId: entityIdSchema,
    trajectoryId: entityIdSchema,
    model: modelInfoSchema,
    status: statusSchema,
    startedAt: isoTimestampSchema,
    endedAt: isoTimestampSchema,
    durationMs: finiteNonNegativeSchema,
    testResults: z.array(testResultSchema).max(MAX_COLLECTION),
  })
  .strict()
  .refine((run) => Date.parse(run.endedAt) >= Date.parse(run.startedAt), {
    path: ["endedAt"],
    message: "must not precede startedAt",
  });

const trajectoryExportSchema = z
  .object({
    trajectory: trajectorySchema,
    exportVersion: z.literal("1.0.0"),
    exportedAt: isoTimestampSchema,
  })
  .strict();

export class InputValidationError extends Error {
  readonly issues: string[];

  constructor(label: string, issues: string[]) {
    super(`${label}: ${issues.join("; ")}`);
    this.name = "InputValidationError";
    this.issues = issues;
  }
}

function parseWithSchema<T>(label: string, schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (result.success) return result.data;

  const issues = result.error.issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join(".") : "value";
    return `${path} ${issue.message}`;
  });
  throw new InputValidationError(label, issues);
}

export function parseEntityId(input: unknown): string {
  return parseWithSchema("Invalid entity ID", entityIdSchema, input);
}

export function parseTaskDefinition(input: unknown): TaskDefinition {
  return parseWithSchema("Invalid task", taskDefinitionSchema, input) as TaskDefinition;
}

export function parseTaskRun(input: unknown): TaskRun {
  return parseWithSchema("Invalid run", taskRunSchema, input) as TaskRun;
}

export function parseTrajectory(input: unknown): Trajectory {
  return parseWithSchema("Invalid trajectory", trajectorySchema, input) as Trajectory;
}

export function parseTrajectoryExport(input: unknown): TrajectoryExport {
  return parseWithSchema(
    "Invalid trajectory export",
    trajectoryExportSchema,
    input,
  ) as TrajectoryExport;
}

function parseIntegerParameter(
  params: URLSearchParams,
  name: string,
  minimum: number,
  maximum?: number,
): number | undefined {
  const raw = params.get(name);
  if (raw === null) return undefined;
  if (!/^\d+$/.test(raw)) {
    throw new InputValidationError("Invalid pagination", [`${name} must be an integer`]);
  }
  const value = Number(raw);
  if (
    !Number.isSafeInteger(value) ||
    value < minimum ||
    (maximum !== undefined && value > maximum)
  ) {
    const range =
      maximum === undefined ? `at least ${minimum}` : `between ${minimum} and ${maximum}`;
    throw new InputValidationError("Invalid pagination", [`${name} must be ${range}`]);
  }
  return value;
}

export function parsePagination(params: URLSearchParams): { limit: number; offset?: number } {
  const limit = parseIntegerParameter(params, "limit", 1, MAX_LIST_LIMIT) ?? MAX_LIST_LIMIT;
  const offset = parseIntegerParameter(params, "offset", 0);
  return {
    limit,
    ...(offset === undefined ? {} : { offset }),
  };
}

export function parseStatus(input: unknown): Status {
  return parseWithSchema("Invalid status", statusSchema, input) as Status;
}
