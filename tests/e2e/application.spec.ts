import { type APIRequestContext, expect, test } from "@playwright/test";
import type { Trajectory } from "../../src/lib/schema";

test.describe.configure({ mode: "serial" });

test.beforeAll(async ({ request, baseURL }) => {
  expect(baseURL).toBeTruthy();
  const response = await request.post("/api/seed", {
    headers: { Origin: baseURL as string },
  });
  expect(response.ok()).toBeTruthy();
});

async function cloneSeededTrajectory(request: APIRequestContext) {
  const response = await request.get("/api/trajectories/example-todo-success-v1");
  expect(response.ok()).toBeTruthy();
  return (await response.json()) as Trajectory;
}

async function saveTrajectory(request: APIRequestContext, baseURL: string, trajectory: Trajectory) {
  const response = await request.post("/api/trajectories", {
    headers: { Origin: baseURL },
    data: trajectory,
  });
  expect(response.ok(), await response.text()).toBeTruthy();
}

test("home page is secure, responsive, and routes to core workflows", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  expect(response?.headers()["content-security-policy"]).toContain("default-src 'self'");
  await expect(page.getByRole("heading", { name: /Inspect agent behavior/i })).toBeVisible();
  await expect(page.getByRole("link", { name: "Browse trajectories" })).toBeVisible();

  await page.setViewportSize({ width: 375, height: 812 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test("primary pages do not create document-level overflow at 320px", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  const routes = [
    "/",
    "/trajectories",
    "/arena",
    "/arena/new",
    "/import",
    "/docs",
    "/seed",
    "/trajectories/example-todo-success-v1",
  ];

  for (const route of routes) {
    await page.goto(route);
    await expect.poll(() => page.evaluate(() => document.readyState)).toBe("complete");
    const widths = await page.evaluate(() => ({
      viewport: window.innerWidth,
      document: document.documentElement.scrollWidth,
      body: document.body.scrollWidth,
    }));
    expect(widths.document, `${route}: ${JSON.stringify(widths)}`).toBeLessThanOrEqual(
      widths.viewport,
    );
    expect(widths.body, `${route}: ${JSON.stringify(widths)}`).toBeLessThanOrEqual(widths.viewport);
  }
});

test("seeded trajectories can be filtered and replayed with keyboard controls", async ({
  page,
}) => {
  await page.goto("/trajectories");
  await expect(page.getByRole("heading", { name: "Build a Todo List App" })).toHaveCount(2);

  await page.getByLabel("Filter by status").selectOption("partial");
  await expect(page.getByRole("heading", { name: "Build a Todo List App" })).toHaveCount(1);
  await page.getByLabel("Filter by status").selectOption("");

  await page.locator('a[href^="/trajectories/"]').first().click();
  await expect(page.getByLabel("Final trajectory outcome")).toBeVisible();
  await expect(page.getByText(/Step 1 of \d+/)).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByText(/Step 2 of \d+/)).toBeVisible();
});

test("replay keyboard controls preserve native inputs and implement accessible tabs", async ({
  page,
}) => {
  await page.goto("/trajectories/example-todo-success-v1");

  const speed = page.getByLabel("Speed");
  await speed.focus();
  await page.keyboard.press("ArrowRight");
  await expect(speed).toHaveValue("2");
  await expect(page.getByText(/Step 1 of \d+/)).toBeVisible();

  const reasoning = page.getByRole("tab", { name: "Reasoning" });
  await reasoning.focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Tool" })).toBeFocused();
  await expect(page.getByRole("tab", { name: "Tool" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByText(/Step 1 of \d+/)).toBeVisible();
});

test("arena ranks imported runs and links to replay", async ({ page }) => {
  await page.goto("/arena");
  await expect(page.getByRole("heading", { name: "Build a Todo List App" }).first()).toBeVisible();
  await expect(page.locator("tbody tr")).toHaveCount(2);
  await expect(page.getByRole("link", { name: "Open" })).toHaveCount(2);
});

test("task creation reports success through the arena", async ({ page }) => {
  await page.goto("/arena/new");
  await page.getByLabel("Title").fill("E2E reliability task");
  await page.getByLabel("Description").fill("Created by the production browser suite.");
  await page
    .getByRole("textbox", { name: "Success criteria item", exact: true })
    .fill("The browser flow succeeds");
  await page.getByRole("textbox", { name: "Test commands item", exact: true }).fill("npm test");
  await page.getByRole("button", { name: "Save task" }).click();

  await expect(page).toHaveURL(/\/arena$/);
  await expect(page.getByRole("button", { name: /E2E reliability task/ })).toBeVisible();
});

test("primary pages avoid document-level horizontal overflow at 320px", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  for (const path of [
    "/",
    "/trajectories",
    "/arena",
    "/arena/new",
    "/import",
    "/seed",
    "/docs",
    "/trajectories/example-todo-success-v1",
  ]) {
    await page.goto(path);
    await expect
      .poll(() =>
        page.evaluate(() => ({
          viewport: window.innerWidth,
          documentWidth: document.documentElement.scrollWidth,
        })),
      )
      .toEqual({ viewport: 320, documentWidth: 320 });
  }
});

test("invalid imports produce an accessible actionable error", async ({ page }) => {
  await page.goto("/import");
  await page.getByLabel("Trajectory JSON").fill("{invalid-json");
  await page.getByRole("button", { name: "Validate and import" }).click();

  await expect(page.getByRole("alert").filter({ hasText: "Import failed" })).toContainText(
    "Import failed",
  );
});

test("the newest selected import file wins when reads resolve out of order", async ({ page }) => {
  await page.addInitScript(() => {
    const original = File.prototype.text;
    File.prototype.text = function delayedText() {
      const delay = this.name === "slow.json" ? 250 : 5;
      return new Promise<string>((resolve, reject) => {
        window.setTimeout(() => original.call(this).then(resolve, reject), delay);
      });
    };
  });
  await page.goto("/import");
  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles({
    name: "slow.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"selected":"old slow file"}'),
  });
  await fileInput.setInputFiles({
    name: "fast.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"selected":"new fast file"}'),
  });

  await page.waitForTimeout(350);
  await expect(page.getByLabel("Trajectory JSON")).toHaveValue('{"selected":"new fast file"}');
});

test("failed trajectory loads do not masquerade as an empty writable collection", async ({
  page,
}) => {
  await page.route("**/api/trajectories**", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "storage unavailable", code: "STORAGE_UNAVAILABLE" }),
    }),
  );
  await page.goto("/trajectories");

  await expect(
    page.locator('[role="alert"]').filter({ hasText: "storage unavailable" }),
  ).toContainText("storage unavailable");
  await expect(page.getByRole("heading", { name: "No trajectories yet" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Load examples" })).toHaveCount(0);
});

test("leaderboard retry preserves the selected task and retries the failed request", async ({
  page,
}) => {
  let attempts = 0;
  await page.route("**/api/leaderboard?taskId=task-todo-list", async (route) => {
    attempts += 1;
    if (attempts === 1) {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "leaderboard unavailable", code: "STORAGE_UNAVAILABLE" }),
      });
      return;
    }
    await route.continue();
  });
  await page.goto("/arena");
  const todoTask = page.getByRole("button", { name: /Build a Todo List App/ });
  await todoTask.click();
  await expect(
    page.locator('[role="alert"]').filter({ hasText: "leaderboard unavailable" }),
  ).toContainText("leaderboard unavailable");

  await page.getByRole("button", { name: "Retry leaderboard" }).click();
  await expect(todoTask).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("tbody tr")).toHaveCount(2);
});

test("trajectory collections load in bounded pages on explicit demand", async ({ page }) => {
  const summary = {
    runId: null,
    title: "Bounded trajectory",
    description: "pagination fixture",
    modelName: "fixture-model",
    provider: "fixture",
    status: "success",
    startedAt: "2026-07-26T10:00:00.000Z",
    endedAt: "2026-07-26T10:00:01.000Z",
    durationMs: 1000,
    stepsCount: 1,
    tokensInput: 1,
    tokensOutput: 1,
    tokensTotal: 2,
    createdAt: "2026-07-26T10:00:00.000Z",
    updatedAt: "2026-07-26T10:00:01.000Z",
  };
  await page.route("**/api/trajectories?limit=100&offset=*", async (route) => {
    const offset = Number(new URL(route.request().url()).searchParams.get("offset"));
    const count = offset === 0 ? 100 : 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(
        Array.from({ length: count }, (_, index) => ({
          ...summary,
          id: `bounded-${offset + index}`,
        })),
      ),
    });
  });
  await page.goto("/trajectories");
  await expect(page.getByRole("link", { name: "Replay" })).toHaveCount(100);

  await page.getByRole("button", { name: "Load more trajectories" }).click();
  await expect(page.getByRole("link", { name: "Replay" })).toHaveCount(101);
  await expect(page.getByRole("button", { name: "Load more trajectories" })).toHaveCount(0);
});

test("replay output and custom file input expose visible keyboard focus", async ({ page }) => {
  await page.goto("/trajectories/example-todo-success-v1");
  const selectedTab = page.getByRole("tab", { selected: true });
  await selectedTab.focus();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Jump to replay output" })).toBeFocused();
  expect(
    await page.getByRole("tabpanel").evaluate((panel) => panel.contains(document.activeElement)),
  ).toBe(true);

  await page.goto("/import");
  const fileInput = page.locator('input[type="file"]');
  await fileInput.focus();
  const focusStyle = await fileInput.evaluate((input) => {
    const label = input.closest("label");
    const style = label ? getComputedStyle(label) : null;
    return { width: style?.outlineWidth, style: style?.outlineStyle };
  });
  expect(focusStyle.style).not.toBe("none");
  expect(focusStyle.width).not.toBe("0px");
});

test("valid adversarial content stays within the viewport and test rendering is capped", async ({
  page,
  request,
  baseURL,
}) => {
  const trajectory = await cloneSeededTrajectory(request);
  trajectory.id = "adversarial-rendering";
  trajectory.runId = "adversarial-rendering-run";
  trajectory.metadata.task = {
    ...trajectory.metadata.task,
    id: "adversarial-rendering-task",
    title: "T".repeat(1000),
    description: "D".repeat(10_000),
  };
  trajectory.outcome = {
    ...trajectory.outcome,
    summary: "S".repeat(20_000),
    testResults: Array.from({ length: 500 }, (_, index) => ({
      name: `test-${index}`,
      status: "pass",
      output: "passed",
      durationMs: index,
    })),
  };
  await saveTrajectory(request, baseURL as string, trajectory);

  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("/trajectories");
  await expect(page.getByRole("heading", { name: trajectory.metadata.task.title })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);

  await page.goto(`/trajectories/${trajectory.id}`);
  await expect(page.getByLabel("Final trajectory outcome")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await page.getByRole("tab", { name: "Tests" }).click();
  await expect(page.getByText("Showing 200 of 500 test results")).toBeVisible();
  await expect(page.getByRole("article")).toHaveCount(200);
});
