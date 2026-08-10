import { NextResponse } from "next/server";
import { StorageConfigurationError, StorageConflictError, StorageCorruptionError } from "./storage";
import { InputValidationError, MAX_REQUEST_BYTES } from "./validation";

export class HttpError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
  }
}

async function cancelBodyQuietly(cancelable: { cancel(reason?: unknown): Promise<void> } | null) {
  if (!cancelable) return;
  try {
    await cancelable.cancel();
  } catch {
    // Preserve the HTTP error that caused cancellation; transport cleanup is best-effort.
  }
}

export async function readJsonBody(
  request: Request,
  maxBytes = MAX_REQUEST_BYTES,
): Promise<unknown> {
  const contentType = request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
  if (contentType !== "application/json") {
    await cancelBodyQuietly(request.body);
    throw new HttpError(415, "UNSUPPORTED_MEDIA_TYPE", "Content-Type must be application/json");
  }

  const declaredLength = request.headers.get("content-length");
  if (declaredLength !== null) {
    if (!/^\d+$/.test(declaredLength)) {
      await cancelBodyQuietly(request.body);
      throw new HttpError(
        400,
        "INVALID_CONTENT_LENGTH",
        "Content-Length must be a non-negative integer",
      );
    }
    if (Number(declaredLength) > maxBytes) {
      await cancelBodyQuietly(request.body);
      throw new HttpError(413, "PAYLOAD_TOO_LARGE", `JSON payload exceeds ${maxBytes} bytes`);
    }
  }

  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, "EMPTY_BODY", "JSON request body is required");
  const decoder = new TextDecoder();
  let text = "";
  let receivedBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    receivedBytes += value.byteLength;
    if (receivedBytes > maxBytes) {
      await cancelBodyQuietly(reader);
      throw new HttpError(413, "PAYLOAD_TOO_LARGE", `JSON payload exceeds ${maxBytes} bytes`);
    }
    text += decoder.decode(value, { stream: true });
  }
  text += decoder.decode();
  if (!text.trim()) {
    throw new HttpError(400, "EMPTY_BODY", "JSON request body is required");
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, "INVALID_JSON", "Request body is not valid JSON");
  }
}

function requireSameOrigin(request: Request): void {
  if (request.headers.get("sec-fetch-site") === "cross-site") {
    throw new HttpError(403, "CROSS_ORIGIN", "Cross-origin mutation requests are not allowed");
  }

  const origin = request.headers.get("origin");
  if (!origin) {
    if (
      process.env.NODE_ENV === "production" &&
      process.env.TRAJECTORY_ALLOW_ORIGINLESS_MUTATIONS !== "true"
    ) {
      throw new HttpError(
        403,
        "ORIGIN_REQUIRED",
        "Mutation requests must include an Origin header",
      );
    }
    return;
  }
  const expectedOrigin = process.env.TRAJECTORY_PUBLIC_ORIGIN
    ? new URL(process.env.TRAJECTORY_PUBLIC_ORIGIN).origin
    : new URL(request.url).origin;
  try {
    if (new URL(origin).origin !== expectedOrigin) {
      throw new HttpError(403, "CROSS_ORIGIN", "Cross-origin mutation requests are not allowed");
    }
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(403, "CROSS_ORIGIN", "Cross-origin mutation requests are not allowed");
  }
}

export function requireWritable(request?: Request): void {
  if (process.env.TRAJECTORY_READ_ONLY?.toLowerCase() === "true") {
    throw new HttpError(403, "READ_ONLY", "Trajectory Arena is running in read-only mode");
  }
  if (request) requireSameOrigin(request);
}

export function requireSeedEnabled(request?: Request): void {
  requireWritable(request);
  if (
    process.env.NODE_ENV === "production" &&
    process.env.TRAJECTORY_ENABLE_SEED?.toLowerCase() !== "true"
  ) {
    throw new HttpError(403, "SEED_DISABLED", "Example data seeding is disabled in production");
  }
}

export function jsonResponse(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

const OPERATIONAL_FILESYSTEM_CODES = new Set([
  "EACCES",
  "EDQUOT",
  "EMFILE",
  "ENFILE",
  "ENOSPC",
  "EPERM",
  "EROFS",
]);

function isOperationalFilesystemError(error: unknown): boolean {
  if (error instanceof AggregateError) {
    return error.errors.some(isOperationalFilesystemError);
  }
  if (error instanceof Error && "code" in error && typeof error.code === "string") {
    return OPERATIONAL_FILESYSTEM_CODES.has(error.code);
  }
  return false;
}

export function errorResponse(error: unknown): NextResponse {
  if (error instanceof HttpError) {
    return jsonResponse({ error: error.message, code: error.code }, error.status);
  }
  if (error instanceof InputValidationError) {
    return jsonResponse(
      { error: "Request validation failed", code: "INVALID_INPUT", details: error.issues },
      400,
    );
  }
  if (error instanceof StorageConflictError) {
    return jsonResponse({ error: error.message, code: "CONFLICT" }, 409);
  }
  if (error instanceof StorageConfigurationError) {
    if (process.env.NODE_ENV !== "test") console.error(error);
    return jsonResponse(
      { error: "Storage is not configured for this deployment", code: "STORAGE_UNAVAILABLE" },
      503,
    );
  }
  if (error instanceof StorageCorruptionError) {
    if (process.env.NODE_ENV !== "test") console.error(error);
    return jsonResponse(
      { error: "Stored data failed integrity validation", code: "STORAGE_CORRUPTION" },
      500,
    );
  }
  if (isOperationalFilesystemError(error)) {
    if (process.env.NODE_ENV !== "test") console.error(error);
    return jsonResponse(
      { error: "Storage is temporarily unavailable", code: "STORAGE_UNAVAILABLE" },
      503,
    );
  }

  if (process.env.NODE_ENV !== "test") console.error(error);
  return jsonResponse({ error: "Internal server error", code: "INTERNAL_ERROR" }, 500);
}

export function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === "object" && input !== null && !Array.isArray(input);
}
