import { NextRequest, NextResponse } from "next/server";
import { importTrajectory } from "@/lib/storage";

/**
 * POST /api/import
 * Import a trajectory from a JSON string or file.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    let trajectoryJson: string;
    let source = body.source || "api";

    if (typeof body.trajectory === "string") {
      trajectoryJson = body.trajectory;
    } else if (typeof body.trajectory === "object") {
      trajectoryJson = JSON.stringify(body.trajectory);
    } else {
      return NextResponse.json(
        { error: "Invalid trajectory: must be object or string" },
        { status: 400 }
      );
    }

    const trajectory = importTrajectory(trajectoryJson);

    return NextResponse.json({
      id: trajectory.id,
      success: true,
      source,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Import failed" },
      { status: 500 }
    );
  }
}
