import { errorResponse, jsonResponse, requireSeedEnabled } from "@/lib/api";
import { seedExampleData } from "@/lib/examples";

export async function POST(request: Request) {
  try {
    requireSeedEnabled(request);
    await seedExampleData();
    return jsonResponse({ success: true, message: "Example data is ready" });
  } catch (error) {
    return errorResponse(error);
  }
}
