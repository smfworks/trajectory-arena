import { NextRequest, NextResponse } from "next/server";
import { seedExampleData } from "@/lib/examples";

/**
 * POST /api/seed
 * Seed the database with example data.
 */
export async function POST(request: NextRequest) {
  try {
    await seedExampleData();
    return NextResponse.json({ success: true, message: "Seeded successfully" });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Seed failed" },
      { status: 500 }
    );
  }
}
