import type { NextRequest } from "next/server";
import { errorResponse, jsonResponse } from "@/lib/api";
import { listRuns } from "@/lib/storage";
import { parseEntityId, parsePagination } from "@/lib/validation";

export function GET(request: NextRequest) {
  try {
    const params = new URL(request.url).searchParams;
    const rawTaskId = params.get("taskId");
    const pagination = parsePagination(params);
    const offset = pagination.offset ?? 0;
    const runs = listRuns(rawTaskId === null ? undefined : parseEntityId(rawTaskId));
    return jsonResponse(runs.slice(offset, offset + pagination.limit));
  } catch (error) {
    return errorResponse(error);
  }
}
