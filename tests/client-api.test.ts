import { afterEach, describe, expect, it, vi } from "vitest";
import { apiFetch, ClientApiError, messageFromError } from "@/lib/client-api";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("browser API client", () => {
  it("returns JSON and forces no-store requests", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ value: 42 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiFetch<{ value: number }>("/api/value")).resolves.toEqual({ value: 42 });
    expect(fetchMock).toHaveBeenCalledWith("/api/value", { cache: "no-store" });
  });

  it("preserves structured server errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: "Invalid task",
            code: "INVALID_INPUT",
            details: ["title required"],
          }),
          { status: 400, headers: { "content-type": "application/json" } },
        ),
      ),
    );

    const error = await apiFetch("/api/tasks").catch((caught) => caught);
    expect(error).toBeInstanceOf(ClientApiError);
    expect(error).toMatchObject({
      message: "Invalid task",
      status: 400,
      code: "INVALID_INPUT",
      details: ["title required"],
    });
  });

  it("rejects non-JSON success responses and formats unknown failures", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response("ok", { status: 200, headers: { "content-type": "text/plain" } }),
        ),
    );

    await expect(apiFetch("/api/value")).rejects.toMatchObject({
      message: "Server returned a non-JSON response",
      status: 200,
    });
    expect(messageFromError(new Error("offline"))).toBe("offline");
    expect(messageFromError("offline")).toBe("An unexpected error occurred");
  });
});
