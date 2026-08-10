import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { errorResponse, isRecord, jsonResponse, readJsonBody, requireWritable } from "@/lib/api";
import { deleteTask, listTasks, loadTask, saveTask } from "@/lib/storage";
import { InputValidationError, parseEntityId, parseTaskDefinition } from "@/lib/validation";

export function GET() {
  try {
    return jsonResponse(listTasks());
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    requireWritable(request);
    const body = await readJsonBody(request);
    if (!isRecord(body)) {
      throw new InputValidationError("Invalid task", ["value must be an object"]);
    }

    const id = body.id === undefined ? randomUUID() : parseEntityId(body.id);
    const existing = loadTask(id);
    const now = new Date().toISOString();
    const task = parseTaskDefinition({
      ...body,
      id,
      createdAt: existing?.createdAt ?? body.createdAt ?? now,
      updatedAt: now,
    });
    saveTask(task);
    return jsonResponse({ id: task.id, success: true }, existing ? 200 : 201);
  } catch (error) {
    return errorResponse(error);
  }
}

export function DELETE(request: NextRequest) {
  try {
    requireWritable(request);
    const id = parseEntityId(new URL(request.url).searchParams.get("id"));
    if (!deleteTask(id)) {
      return jsonResponse({ error: "Task not found", code: "NOT_FOUND" }, 404);
    }
    return jsonResponse({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}
