import { NextRequest, NextResponse } from "next/server";
import {
  saveTrajectory,
  deleteTrajectory,
  listTrajectories,
} from "@/lib/storage";
import type { Trajectory } from "@/lib/schema";

/**
 * GET /api/trajectories
 * List all trajectories with optional filtering.
 */
export function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const options: Parameters<typeof listTrajectories>[0] = {
    status: searchParams.get("status") || undefined,
    model: searchParams.get("model") || undefined,
    limit: searchParams.get("limit") ? parseInt(searchParams.get("limit")!) : undefined,
    offset: searchParams.get("offset") ? parseInt(searchParams.get("offset")!) : undefined,
  };

  const trajectories = listTrajectories(options);
  return NextResponse.json(trajectories);
}

/**
 * POST /api/trajectories
 * Create or update a trajectory.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const trajectory = body as Trajectory;

    if (!trajectory.id || !trajectory.metadata || !trajectory.steps) {
      return NextResponse.json(
        { error: "Invalid trajectory: missing required fields" },
        { status: 400 }
      );
    }

    saveTrajectory(trajectory);
    return NextResponse.json({ id: trajectory.id, success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/trajectories?id=xxx
 * Delete a trajectory.
 */
export function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Missing id parameter" }, { status: 400 });
  }

  const deleted = deleteTrajectory(id);
  if (!deleted) {
    return NextResponse.json({ error: "Trajectory not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
