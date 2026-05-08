#!/usr/bin/env node
/**
 * Record a short walkthrough of the dashboard for the README preview
 * section. Captures the same mock task seeded by `seed-preview.mjs`.
 *
 * Usage (re-record):
 *
 *   # 1. Boot a clean preview server + web (see docs/assets/preview/README.md).
 *   # 2. Install Playwright into a scratch dir (one-off — not in package.json):
 *   mkdir -p /tmp/agent-tracer-record && cd /tmp/agent-tracer-record \
 *     && npm init -y >/dev/null && npm install playwright \
 *     && npx playwright install chromium
 *   # 3. Run the recorder against the running web server:
 *   PLAYWRIGHT_PATH=/tmp/agent-tracer-record/node_modules/playwright \
 *     node scripts/record-preview-demo.mjs
 *
 * The output is written to `docs/assets/preview/demo.webm`. GitHub renders
 * .webm inline in markdown via the HTML5 <video> tag.
 */

import { mkdirSync, renameSync, readdirSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..");
const OUT_DIR = join(REPO_ROOT, "docs/assets/preview");
const TMP_DIR = join(REPO_ROOT, ".monitor/preview-recording");
const DEMO_FILE = join(OUT_DIR, "demo.webm");

const URL_BASE = process.env.PREVIEW_URL_BASE ?? "http://127.0.0.1:5273";
const TASK_ID = process.env.PREVIEW_TASK_ID ?? "preview-task-checkout-tax";
const PLAYWRIGHT_PATH =
  process.env.PLAYWRIGHT_PATH ??
  "/tmp/agent-tracer-record/node_modules/playwright";

mkdirSync(OUT_DIR, { recursive: true });
mkdirSync(TMP_DIR, { recursive: true });

const { chromium } = await import(`${PLAYWRIGHT_PATH}/index.mjs`);

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  recordVideo: { dir: TMP_DIR, size: { width: 1440, height: 900 } },
  colorScheme: "dark",
});
const page = await context.newPage();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Scene 1 — task list landing.
await page.goto(`${URL_BASE}/tasks`, { waitUntil: "domcontentloaded" });
await page.waitForSelector("text=cart-tax");
await sleep(2400);

// Scene 2 — open the task and let the feed paint.
await page.goto(`${URL_BASE}/tasks/${TASK_ID}`, { waitUntil: "domcontentloaded" });
await page.waitForSelector("text=Reproduce locally");
await sleep(2800);

// Scene 3 — select a USER message → inspector populated.
await page
  .locator("text=the cart-tax test fails intermittently")
  .first()
  .click();
await sleep(2600);

// Scene 4 — pick a RULE event (terminal command) so the inspector
// shows a different shape (command + exit + output).
await page
  .locator("text=npm test -- cart-tax")
  .first()
  .click();
await sleep(2600);

// Scene 5 — Trace tab.
await page.getByRole("tab", { name: /trace/i }).click().catch(() => undefined);
await sleep(2400);

// Scene 6 — Rules tab.
await page.getByRole("tab", { name: /rules/i }).click().catch(() => undefined);
await sleep(2400);

// Scene 7 — back to Inspect.
await page.getByRole("tab", { name: /inspect/i }).click().catch(() => undefined);
await sleep(1800);

// Scene 8 — switch to graph view and zoom out a step so the swimlane
// layout reads at a glance instead of cramming events together.
await page.getByRole("button", { name: /graph view/i }).click();
await sleep(1600);
const zoomOut = page.getByRole("button", { name: /zoom out/i });
await zoomOut.click().catch(() => undefined);
await sleep(800);
await zoomOut.click().catch(() => undefined);
await sleep(2200);

// Scene 9 — highlight the verification node in the graph. Graph labels
// are visually truncated; use the accessible name (full title) so the
// click reliably lands on the VERI node.
await page
  .getByRole("button", { name: /Cart-tax suite green over 50 stress repeats/ })
  .first()
  .click()
  .catch(() => undefined);
await sleep(2400);

// Scene 10 — lane filter: isolate the RULE lane.
await page.getByRole("button", { name: /^USER$/ }).click().catch(() => undefined);
await page.getByRole("button", { name: /^PLAN$/ }).click().catch(() => undefined);
await page.getByRole("button", { name: /^EXPL$/ }).click().catch(() => undefined);
await page.getByRole("button", { name: /^IMPL$/ }).click().catch(() => undefined);
await sleep(2400);

// Scene 11 — reset filters back to ALL.
await page.getByRole("button", { name: /^ALL$/ }).click().catch(() => undefined);
await sleep(2000);

// Scene 12 — close on the feed for a clean final frame.
await page.getByRole("button", { name: /feed view/i }).click();
await sleep(2400);

await context.close();
await browser.close();

// Playwright assigns the recording a uuid filename — rename to demo.webm.
const recordings = readdirSync(TMP_DIR).filter((f) => f.endsWith(".webm"));
if (recordings.length === 0) {
  throw new Error("Playwright produced no recording");
}
recordings.sort();
const newest = recordings[recordings.length - 1];
renameSync(join(TMP_DIR, newest), DEMO_FILE);
for (const f of recordings.slice(0, -1)) rmSync(join(TMP_DIR, f), { force: true });

process.stdout.write(`recorded: ${DEMO_FILE}\n`);
