const baseUrl = (process.env.SMOKE_BASE_URL ?? "http://127.0.0.1:3000").replace(/\/$/, "");
const username = process.env.SMOKE_BASIC_AUTH_USER;
const password = process.env.SMOKE_BASIC_AUTH_PASSWORD;

if (!username || !password) {
  throw new Error("SMOKE_BASIC_AUTH_USER and SMOKE_BASIC_AUTH_PASSWORD are required");
}

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

async function waitForHealth() {
  let lastError;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.status === 200) return response;
      lastError = new Error(`health returned ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw lastError ?? new Error("health endpoint did not become ready");
}

const health = await waitForHealth();
invariant(health.headers.get("x-request-id"), "health response is missing a request ID");

const anonymous = await fetch(`${baseUrl}/api/tasks`);
invariant(anonymous.status === 401, `anonymous request returned ${anonymous.status}, expected 401`);
invariant(
  anonymous.headers.get("www-authenticate")?.startsWith("Basic"),
  "challenge header missing",
);
invariant(anonymous.headers.get("x-request-id"), "anonymous response is missing a request ID");

const badCredentials = await fetch(`${baseUrl}/api/tasks`, {
  headers: {
    Authorization: `Basic ${Buffer.from(`${username}:incorrect`).toString("base64")}`,
  },
});
invariant(badCredentials.status === 401, "bad credentials were not rejected");

const authenticated = await fetch(`${baseUrl}/api/tasks`, {
  headers: {
    Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`,
  },
});
invariant(authenticated.status === 200, `authenticated request returned ${authenticated.status}`);
invariant(
  authenticated.headers.get("x-request-id"),
  "authenticated response is missing a request ID",
);
invariant(Array.isArray(await authenticated.json()), "authenticated task payload is not an array");

process.stdout.write(
  `${JSON.stringify({ status: "ok", health: health.status, anonymous: anonymous.status, authenticated: authenticated.status })}\n`,
);
