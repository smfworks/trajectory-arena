import { NextRequest, NextResponse } from "next/server";
import { loadTask } from "@/lib/storage";

/**
 * GET /api/tasks/[id]
 * Get a single task by ID.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const task = loadTask(id);

  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  return NextResponse.json(task);
}
