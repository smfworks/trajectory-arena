const baseUrl = (process.env.SMOKE_BASE_URL ?? "http://127.0.0.1:3000").replace(/\/$/, "");

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { response, body };
}

async function waitForHealth() {
  let lastError;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const result = await request("/api/health");
      if (result.response.status === 200 && result.body?.status === "ok") return result;
      lastError = new Error(
        `health returned ${result.response.status}: ${JSON.stringify(result.body)}`,
      );
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw lastError ?? new Error("health endpoint did not become ready");
}

const health = await waitForHealth();
invariant(health.body.version === "1.0.0", "health version mismatch");
invariant(health.body.schemaVersion === "1.0.0", "health schema mismatch");
invariant(
  health.response.headers.get("cache-control")?.includes("no-store"),
  "health must be no-store",
);

const home = await request("/");
invariant(home.response.status === 200, `home returned ${home.response.status}`);
invariant(
  home.response.headers.get("content-security-policy")?.includes("default-src 'self'"),
  "CSP missing",
);

const blockedCrossOrigin = await request("/api/seed", {
  method: "POST",
  headers: { Origin: "https://attacker.invalid", "Sec-Fetch-Site": "cross-site" },
});
invariant(blockedCrossOrigin.response.status === 403, "cross-origin mutation was not rejected");

const seeded = await request("/api/seed", {
  method: "POST",
  headers: { Origin: baseUrl },
});
invariant(seeded.response.status === 200, `seed returned ${seeded.response.status}`);

const trajectories = await request("/api/trajectories?limit=100");
invariant(trajectories.response.status === 200, "trajectory listing failed");
invariant(
  Array.isArray(trajectories.body) && trajectories.body.length === 2,
  "expected two seeded trajectories",
);

const firstId = trajectories.body[0].id;
const detail = await request(`/api/trajectories/${encodeURIComponent(firstId)}`);
invariant(detail.response.status === 200 && detail.body.id === firstId, "trajectory detail failed");

const exported = await request(`/api/trajectories/${encodeURIComponent(firstId)}/export`);
invariant(exported.response.status === 200, "trajectory export failed");
invariant(exported.body?.trajectory?.id === firstId, "export trajectory mismatch");

const tasks = await request("/api/tasks");
invariant(Array.isArray(tasks.body) && tasks.body.length === 1, "expected one seeded task");
const leaderboard = await request(
  `/api/leaderboard?taskId=${encodeURIComponent(tasks.body[0].id)}`,
);
invariant(
  Array.isArray(leaderboard.body) && leaderboard.body.length === 2,
  "expected two leaderboard runs",
);

process.stdout.write(
  `${JSON.stringify({
    status: "ok",
    version: health.body.version,
    trajectories: trajectories.body.length,
    tasks: tasks.body.length,
    leaderboardEntries: leaderboard.body.length,
  })}\n`,
);
