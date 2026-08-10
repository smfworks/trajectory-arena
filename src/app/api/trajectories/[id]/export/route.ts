import type { NextRequest } from "next/server";
import { errorResponse, jsonResponse } from "@/lib/api";
import { exportTrajectory } from "@/lib/storage";
import { parseEntityId } from "@/lib/validation";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const id = parseEntityId((await params).id);
    const json = exportTrajectory(id);
    return new Response(json, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="trajectory-${id}.json"`,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Trajectory not found:")) {
      return jsonResponse({ error: "Trajectory not found", code: "NOT_FOUND" }, 404);
    }
    return errorResponse(error);
  }
}
