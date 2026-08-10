import type { NextRequest } from "next/server";
import { errorResponse, jsonResponse } from "@/lib/api";
import { getLeaderboard } from "@/lib/storage";
import { InputValidationError, parseEntityId } from "@/lib/validation";

export function GET(request: NextRequest) {
  try {
    const taskId = new URL(request.url).searchParams.get("taskId");
    if (taskId === null) {
      throw new InputValidationError("Invalid leaderboard request", ["taskId is required"]);
    }
    return jsonResponse(getLeaderboard(parseEntityId(taskId)));
  } catch (error) {
    return errorResponse(error);
  }
}
