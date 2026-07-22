import { NextRequest, NextResponse } from "next/server";
import {
  saveTask,
  loadTask,
  listTasks,
  deleteTask,
} from "@/lib/storage";
import type { TaskDefinition } from "@/lib/schema";

/**
 * GET /api/tasks
 * List all tasks.
 */
export async function GET() {
  const tasks = await listTasks();
  return NextResponse.json(tasks);
}

/**
 * POST /api/tasks
 * Create or update a task.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const task = body as TaskDefinition;

    if (!task.id || !task.title) {
      return NextResponse.json(
        { error: "Invalid task: missing required fields" },
        { status: 400 }
      );
    }

    // Ensure timestamps
    if (!task.createdAt) task.createdAt = new Date().toISOString();
    task.updatedAt = new Date().toISOString();

    await saveTask(task);
    return NextResponse.json({ id: task.id, success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/tasks?id=xxx
 * Delete a task.
 */
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Missing id parameter" }, { status: 400 });
  }

  const deleted = await deleteTask(id);
  if (!deleted) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
