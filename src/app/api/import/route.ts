import type { NextRequest } from "next/server";
import { errorResponse, isRecord, jsonResponse, readJsonBody, requireWritable } from "@/lib/api";
import { importTrajectory } from "@/lib/storage";
import { InputValidationError } from "@/lib/validation";

export async function POST(request: NextRequest) {
  try {
    requireWritable(request);
    const body = await readJsonBody(request);
    if (!isRecord(body)) {
      throw new InputValidationError("Invalid import", ["value must be an object"]);
    }
    if (typeof body.trajectory !== "string" && !isRecord(body.trajectory)) {
      throw new InputValidationError("Invalid import", [
        "trajectory must be an object or JSON string",
      ]);
    }
    if (
      body.source !== undefined &&
      (typeof body.source !== "string" || body.source.length > 256)
    ) {
      throw new InputValidationError("Invalid import", [
        "source must be a string of at most 256 characters",
      ]);
    }

    const serialized =
      typeof body.trajectory === "string" ? body.trajectory : JSON.stringify(body.trajectory);
    const trajectory = importTrajectory(serialized);
    return jsonResponse({ id: trajectory.id, success: true, source: body.source ?? "api" }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
