interface ErrorPayload {
  error?: string;
  code?: string;
  details?: string[];
}

export class ClientApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly details: string[];

  constructor(message: string, status: number, code?: string, details: string[] = []) {
    super(message);
    this.name = "ClientApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export async function apiFetch<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    cache: "no-store",
    ...init,
  });
  const contentType = response.headers.get("content-type") ?? "";
  const payload = contentType.includes("application/json")
    ? ((await response.json()) as T & ErrorPayload)
    : undefined;

  if (!response.ok) {
    const message = payload?.error ?? `Request failed with HTTP ${response.status}`;
    throw new ClientApiError(message, response.status, payload?.code, payload?.details);
  }
  if (payload === undefined) {
    throw new ClientApiError("Server returned a non-JSON response", response.status);
  }
  return payload;
}

export function messageFromError(error: unknown): string {
  return error instanceof Error ? error.message : "An unexpected error occurred";
}
