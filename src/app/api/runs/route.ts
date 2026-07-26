import type { NextRequest } from "next/server";
import { errorResponse, jsonResponse } from "@/lib/api";
import { listRuns } from "@/lib/storage";
import { parseEntityId } from "@/lib/validation";

export function GET(request: NextRequest) {
  try {
    const rawTaskId = new URL(request.url).searchParams.get("taskId");
    return jsonResponse(listRuns(rawTaskId === null ? undefined : parseEntityId(rawTaskId)));
  } catch (error) {
    return errorResponse(error);
  }
}
