import { describe, expect, it } from "vitest";
import { getFileStateAtStep, getPanelForStep, replayProgress } from "@/lib/replay";
import { makeSteps } from "./fixtures";

describe("replay state", () => {
  it("reconstructs file state without mutating earlier snapshots", () => {
    const steps = makeSteps();
    const atCreate = getFileStateAtStep(steps, 1);
    steps.push({
      stepIndex: 3,
      timestamp: "2026-07-26T10:00:03.000Z",
      type: "file_edit",
      data: {
        fileEdit: {
          filePath: "src/index.ts",
          operation: "edit",
          oldContent: "export const answer = 42;\n",
          newContent: "export const answer = 43;\n",
        },
      },
    });

    expect(getFileStateAtStep(steps, 3)["src/index.ts"]).toContain("43");
    expect(atCreate["src/index.ts"]).toContain("42");
  });

  it("treats checkpoints as complete snapshots and removes stale files", () => {
    const steps = makeSteps();
    steps.push({
      stepIndex: 3,
      timestamp: "2026-07-26T10:00:03.000Z",
      type: "checkpoint",
      data: { checkpoint: { type: "state", files: { "README.md": "ready" } } },
    });

    expect(getFileStateAtStep(steps, 3)).toEqual({ "README.md": "ready" });
  });

  it("starts replay from task starter files before applying edits", () => {
    expect(
      getFileStateAtStep(makeSteps(), 0, [
        { path: "src/starter.ts", content: "export const seeded = true;\n" },
      ]),
    ).toEqual({ "src/starter.ts": "export const seeded = true;\n" });
  });

  it("preserves starter files even when a valid trajectory has no steps", () => {
    expect(
      getFileStateAtStep([], 0, [
        { path: "src/starter.ts", content: "export const seeded = true;\n" },
      ]),
    ).toEqual({ "src/starter.ts": "export const seeded = true;\n" });
  });

  it("derives panels and handles empty progress safely", () => {
    expect(getPanelForStep(makeSteps()[1])).toBe("files");
    expect(replayProgress(0, 0)).toBe(0);
    expect(replayProgress(1, 3)).toBeCloseTo(2 / 3);
  });
});
