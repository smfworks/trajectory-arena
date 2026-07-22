import { NextRequest, NextResponse } from "next/server";
import {
  loadTrajectory,
  exportTrajectory,
  deleteTrajectory,
} from "@/lib/storage";

/**
 * GET /api/trajectories/[id]
 * Get a single trajectory by ID.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const trajectory = loadTrajectory(id);

  if (!trajectory) {
    return NextResponse.json({ error: "Trajectory not found" }, { status: 404 });
  }

  return NextResponse.json(trajectory);
}

/**
 * DELETE /api/trajectories/[id]
 * Delete a trajectory by ID.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const deleted = deleteTrajectory(id);

  if (!deleted) {
    return NextResponse.json({ error: "Trajectory not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}

/**
 * POST /api/trajectories/[id]/export
 * Export a trajectory to JSON.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const json = exportTrajectory(id);
    return NextResponse.json(JSON.parse(json));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Export failed" },
      { status: 500 }
    );
  }
}
