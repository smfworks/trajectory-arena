import type { NextRequest } from "next/server";
import { errorResponse, jsonResponse } from "@/lib/api";
import { getLeaderboard } from "@/lib/storage";
import { InputValidationError, parseEntityId, parsePagination } from "@/lib/validation";

export function GET(request: NextRequest) {
  try {
    const params = new URL(request.url).searchParams;
    const taskId = params.get("taskId");
    if (taskId === null) {
      throw new InputValidationError("Invalid leaderboard request", ["taskId is required"]);
    }
    const pagination = parsePagination(params);
    const offset = pagination.offset ?? 0;
    return jsonResponse(getLeaderboard(parseEntityId(taskId)).slice(offset, offset + pagination.limit));
  } catch (error) {
    return errorResponse(error);
  }
}
