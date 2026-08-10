import { describe, expect, it } from "vitest";
import {
  parseEntityId,
  parsePagination,
  parseTaskDefinition,
  parseTrajectory,
} from "@/lib/validation";
import { makeTask, makeTrajectory } from "./fixtures";

describe("runtime validation", () => {
  it("defaults trajectory pagination to the bounded maximum", () => {
    expect(parsePagination(new URLSearchParams())).toEqual({ limit: 100 });
  });

  it.each(["../escape", "a/b", "a\\b", ".", "..", "", " space", "x".repeat(129)])(
    "rejects unsafe entity ID %j",
    (id) => {
      expect(() => parseEntityId(id)).toThrow();
    },
  );

  it.each(["valid-id", "task_123", "550e8400-e29b-41d4-a716-446655440000"])(
    "accepts portable entity ID %j",
    (id) => {
      expect(parseEntityId(id)).toBe(id);
    },
  );

  it("rejects type/data mismatches in trajectory steps", () => {
    const trajectory = makeTrajectory();
    trajectory.steps[0] = {
      stepIndex: 0,
      timestamp: "2026-07-26T10:00:00.000Z",
      type: "terminal",
      data: { message: { text: "wrong payload", sender: "user" } },
    };

    expect(() => parseTrajectory(trajectory)).toThrow(/terminal|data/i);
  });

  it("rejects non-contiguous step indexes", () => {
    const trajectory = makeTrajectory();
    trajectory.steps[1].stepIndex = 8;

    expect(() => parseTrajectory(trajectory)).toThrow(/stepIndex|contiguous/i);
  });

  it("rejects incomplete task objects rather than trusting TypeScript casts", () => {
    expect(() => parseTaskDefinition({ id: "task", title: "only two fields" })).toThrow();
    expect(parseTaskDefinition(makeTask()).id).toBe("task-valid");
  });

  it("validates and bounds list pagination", () => {
    expect(parsePagination(new URLSearchParams("limit=25&offset=10"))).toEqual({
      limit: 25,
      offset: 10,
    });
    expect(() => parsePagination(new URLSearchParams("limit=NaN"))).toThrow();
    expect(() => parsePagination(new URLSearchParams("limit=101"))).toThrow();
    expect(() => parsePagination(new URLSearchParams("offset=-1"))).toThrow();
  });

  it("rejects duration metadata that disagrees with the timestamp interval", () => {
    const trajectory = makeTrajectory();
    trajectory.metadata.timing.durationMs = 0;
    trajectory.metadata.stats.durationMs = 0;

    expect(() => parseTrajectory(trajectory)).toThrow(/duration/i);
  });
});
