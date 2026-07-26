import type { NextRequest } from "next/server";
import { errorResponse, jsonResponse, readJsonBody, requireWritable } from "@/lib/api";
import { deleteTrajectory, listTrajectories, loadTrajectory, saveTrajectory } from "@/lib/storage";
import {
  InputValidationError,
  parseEntityId,
  parsePagination,
  parseStatus,
  parseTrajectory,
} from "@/lib/validation";

export function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const pagination = parsePagination(searchParams);
    const rawStatus = searchParams.get("status");
    const rawModel = searchParams.get("model");
    if (rawModel !== null && rawModel.length > 1_000) {
      throw new InputValidationError("Invalid model filter", ["model exceeds 1000 characters"]);
    }

    return jsonResponse(
      listTrajectories({
        ...pagination,
        status: rawStatus === null ? undefined : parseStatus(rawStatus),
        model: rawModel?.trim() || undefined,
      }),
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    requireWritable(request);
    const trajectory = parseTrajectory(await readJsonBody(request));
    const existed = loadTrajectory(trajectory.id) !== null;
    saveTrajectory(trajectory);
    return jsonResponse({ id: trajectory.id, success: true }, existed ? 200 : 201);
  } catch (error) {
    return errorResponse(error);
  }
}

export function DELETE(request: NextRequest) {
  try {
    requireWritable(request);
    const id = parseEntityId(new URL(request.url).searchParams.get("id"));
    if (!deleteTrajectory(id)) {
      return jsonResponse({ error: "Trajectory not found", code: "NOT_FOUND" }, 404);
    }
    return jsonResponse({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}
