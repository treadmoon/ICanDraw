import { test, expect } from "@playwright/test";

/**
 * E2E tests for task engine + layout validator integration.
 *
 * The chat pipeline now splits into 4 tasks:
 *   1. intent → /api/chat/raw (returns intent JSON)
 *   2. structure → /api/chat/raw (returns nodes/edges JSON)
 *   3. layout → local computation (no API call)
 *   4. annotations → /api/chat/raw (returns annotations JSON)
 */

// --- Mock responses for each task ---

const INTENT_RESPONSE = {
  type: "drawing",
  chartCount: 0,
  drawingType: "flowchart",
  description: "一个测试流程图",
};

const STRUCTURE_RESPONSE_CLEAN = {
  charts: [],
  nodes: [
    { id: "n1", type: "rectangle", text: "步骤1", backgroundColor: "#a5d8ff" },
    { id: "n2", type: "rectangle", text: "步骤2", backgroundColor: "#a5d8ff" },
  ],
  edges: [{ from: "n1", to: "n2" }],
  summary: "测试正常布局",
};

const STRUCTURE_RESPONSE_COMPLEX = {
  charts: [],
  nodes: [
    { id: "n1", type: "ellipse", text: "开始", backgroundColor: "#e7f5ff" },
    { id: "n2", type: "rectangle", text: "处理A", backgroundColor: "#a5d8ff" },
    { id: "n3", type: "diamond", text: "判断?", backgroundColor: "#fff3bf" },
    { id: "n4", type: "rectangle", text: "处理B", backgroundColor: "#a5d8ff" },
    { id: "n5", type: "ellipse", text: "结束", backgroundColor: "#b2f2bb" },
  ],
  edges: [
    { from: "n1", to: "n2" },
    { from: "n2", to: "n3" },
    { from: "n3", to: "n4", label: "是" },
    { from: "n3", to: "n5", label: "否" },
    { from: "n4", to: "n5" },
  ],
  summary: "测试复杂流程图",
};

const ANNOTATION_RESPONSE = {
  annotations: [],
};

// --- Helpers ---

function mockChatRawAPI(
  page: import("@playwright/test").Page,
  structureResponse: object
) {
  let callCount = 0;
  return page.route("**/api/chat/raw", async (route) => {
    callCount++;
    let body: object;
    if (callCount === 1) {
      // Task 1: intent
      body = { content: JSON.stringify(INTENT_RESPONSE) };
    } else if (callCount === 2) {
      // Task 2: structure
      body = { content: JSON.stringify(structureResponse) };
    } else {
      // Task 4: annotations
      body = { content: JSON.stringify(ANNOTATION_RESPONSE) };
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
}

async function sendMessage(page: import("@playwright/test").Page, text: string) {
  const textarea = page.locator("textarea").first();
  await textarea.fill(text);
  await textarea.press("Enter");
}

// --- Tests ---

test.describe("Task Engine E2E", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });
    await page.locator(".excalidraw").waitFor({ state: "visible", timeout: 15000 });
    await page.waitForTimeout(1000);
  });

  test("page loads correctly", async ({ page }) => {
    await expect(page.locator(".excalidraw")).toBeVisible();
    await expect(page.locator("textarea")).toBeVisible();
  });

  test("clean structure: tasks complete and result shown", async ({ page }) => {
    await mockChatRawAPI(page, STRUCTURE_RESPONSE_CLEAN);
    await sendMessage(page, "画一个流程图");

    // Task progress should appear
    const taskProgress = page.locator("text=分析意图");
    await expect(taskProgress).toBeVisible({ timeout: 5000 });

    // Final result
    await expect(page.locator("text=测试正常布局")).toBeVisible({ timeout: 30000 });
  });

  test("complex flowchart: all tasks complete", async ({ page }) => {
    await mockChatRawAPI(page, STRUCTURE_RESPONSE_COMPLEX);
    await sendMessage(page, "画一个复杂流程图");

    await expect(page.locator("text=测试复杂流程图")).toBeVisible({ timeout: 30000 });
  });

  test("task progress shows all 4 task names", async ({ page }) => {
    await mockChatRawAPI(page, STRUCTURE_RESPONSE_CLEAN);
    await sendMessage(page, "画一个图");

    // All 4 task names should appear at some point
    await expect(page.locator("text=分析意图")).toBeVisible({ timeout: 5000 });
    // Wait for completion
    await expect(page.locator("text=测试正常布局")).toBeVisible({ timeout: 30000 });
  });

  test("API failure triggers retry and shows error", async ({ page }) => {
    let callCount = 0;
    await page.route("**/api/chat/raw", async (route) => {
      callCount++;
      if (callCount <= 3) {
        // First 3 calls fail (intent task retries 3 times)
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: "AI 服务异常" }),
        });
      } else {
        // After user retries, succeed
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ content: JSON.stringify(INTENT_RESPONSE) }),
        });
      }
    });

    await sendMessage(page, "画一个图");

    // Should show "waiting for user" intervention panel after 3 retries
    await expect(page.locator("text=再试一次")).toBeVisible({ timeout: 30000 });
    // Should show retry count
    await expect(page.locator("text=重试 3 次仍失败").first()).toBeVisible({ timeout: 5000 });
  });

  test("API error: user can abort", async ({ page }) => {
    await page.route("**/api/chat/raw", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "AI 服务异常" }),
      });
    });

    await sendMessage(page, "画一个图");

    // Wait for intervention panel
    await expect(page.locator("text=终止")).toBeVisible({ timeout: 30000 });

    // Click abort
    await page.locator("text=终止").click();

    // Should show failure message
    await expect(page.locator("text=失败").first()).toBeVisible({ timeout: 5000 });
  });
});
