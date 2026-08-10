import type { FileSpec, TrajectoryStep } from "./schema";

export type ReplayPanel = "reasoning" | "tool" | "terminal" | "files" | "tests";

export function getPanelForStep(step: TrajectoryStep | undefined): ReplayPanel {
  switch (step?.type) {
    case "tool_call":
    case "tool_result":
      return "tool";
    case "terminal":
      return "terminal";
    case "file_edit":
    case "checkpoint":
      return "files";
    case "test_result":
      return "tests";
    default:
      return "reasoning";
  }
}

export function getFileStateAtStep(
  steps: readonly TrajectoryStep[],
  currentStep: number,
  starterFiles: ReadonlyArray<Pick<FileSpec, "path" | "content">> = [],
): Record<string, string> {
  let files: Record<string, string> = Object.fromEntries(
    starterFiles.map((file) => [file.path, file.content]),
  );
  if (currentStep < 0) return {};
  if (steps.length === 0) return files;

  const end = Math.min(Math.floor(currentStep), steps.length - 1);
  let start = 0;

  for (let index = end; index >= 0; index -= 1) {
    const checkpoint = steps[index].data.checkpoint;
    if (steps[index].type === "checkpoint" && checkpoint) {
      files = { ...checkpoint.files };
      start = index + 1;
      break;
    }
  }

  for (let index = start; index <= end; index += 1) {
    const step = steps[index];
    if (step.type !== "file_edit" || !step.data.fileEdit) continue;
    const edit = step.data.fileEdit;
    if (edit.operation === "delete") {
      delete files[edit.filePath];
    } else {
      files[edit.filePath] = edit.newContent ?? "";
    }
  }

  return { ...files };
}

export function replayProgress(currentStep: number, totalSteps: number): number {
  if (!Number.isFinite(totalSteps) || totalSteps <= 0) return 0;
  const safeIndex = Number.isFinite(currentStep) ? Math.floor(currentStep) : 0;
  return Math.min(1, Math.max(0, safeIndex + 1) / totalSteps);
}
