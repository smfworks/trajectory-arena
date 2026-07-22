import { NextRequest, NextResponse } from "next/server";
import { getLeaderboard } from "@/lib/storage";
import type { TaskId } from "@/lib/schema";

/**
 * GET /api/leaderboard?taskId=xxx
 * Get leaderboard entries for a task.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const taskId = searchParams.get("taskId") as TaskId | null;

  if (!taskId) {
    return NextResponse.json(
      { error: "Missing taskId parameter" },
      { status: 400 }
    );
  }

  const entries = await getLeaderboard(taskId);
  return NextResponse.json(entries);
}
