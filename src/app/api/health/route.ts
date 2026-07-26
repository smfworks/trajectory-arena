import { jsonResponse } from "@/lib/api";
import { getStorageHealth, TRAJECTORY_SCHEMA_VERSION } from "@/lib/storage";
import { APP_VERSION } from "@/lib/version";

export function GET() {
  try {
    return jsonResponse({
      status: "ok",
      version: APP_VERSION,
      schemaVersion: TRAJECTORY_SCHEMA_VERSION,
      storage: getStorageHealth(),
    });
  } catch (error) {
    if (process.env.NODE_ENV !== "test") console.error(error);
    return jsonResponse(
      { status: "unhealthy", version: APP_VERSION, schemaVersion: TRAJECTORY_SCHEMA_VERSION },
      503,
    );
  }
}
