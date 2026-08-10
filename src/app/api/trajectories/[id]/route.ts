import type { NextRequest } from "next/server";
import { errorResponse, jsonResponse, requireWritable } from "@/lib/api";
import { deleteTrajectory, loadTrajectory } from "@/lib/storage";
import { parseEntityId } from "@/lib/validation";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const id = parseEntityId((await params).id);
    const trajectory = loadTrajectory(id);
    if (!trajectory) {
      return jsonResponse({ error: "Trajectory not found", code: "NOT_FOUND" }, 404);
    }
    return jsonResponse(trajectory);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    requireWritable(request);
    const id = parseEntityId((await params).id);
    if (!deleteTrajectory(id)) {
      return jsonResponse({ error: "Trajectory not found", code: "NOT_FOUND" }, 404);
    }
    return jsonResponse({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}
