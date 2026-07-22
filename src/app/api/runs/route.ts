import { NextRequest, NextResponse } from "next/server";
import { listRuns } from "@/lib/storage";
import type { TaskId } from "@/lib/schema";

/**
 * GET /api/runs?taskId=xxx
 * List runs, optionally filtered by task.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const taskId = searchParams.get("taskId") as TaskId | null;

  const runs = await listRuns(taskId || undefined);
  return NextResponse.json(runs);
}
