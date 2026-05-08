#!/usr/bin/env node
/**
 * Capture the static screenshots referenced from the README Preview section,
 * matching the same scenes the walkthrough video runs through.
 *
 * Pairs with:
 *   - `scripts/seed-preview.mjs`   (seeds the mock task)
 *   - `scripts/record-preview-demo.mjs` (records demo.webm from the same flow)
 *
 * Outputs (overwrites if present):
 *   - docs/assets/preview/dashboard-overview.png
 *   - docs/assets/preview/feed-graph.png
 *   - docs/assets/preview/inspector.png
 *
 * See `docs/assets/preview/README.md` for the full re-capture workflow.
 */

import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..");
const OUT_DIR = join(REPO_ROOT, "docs/assets/preview");

const URL_BASE = process.env.PREVIEW_URL_BASE ?? "http://127.0.0.1:5273";
const TASK_ID = process.env.PREVIEW_TASK_ID ?? "preview-task-checkout-tax";
const PLAYWRIGHT_PATH =
  process.env.PLAYWRIGHT_PATH ??
  "/tmp/agent-tracer-record/node_modules/playwright";

mkdirSync(OUT_DIR, { recursive: true });

const { chromium } = await import(`${PLAYWRIGHT_PATH}/index.mjs`);

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  colorScheme: "dark",
});
const page = await context.newPage();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Scene 1 — feed view, fresh load, no selection.
// Matches the video's opening "open task" frame.
await page.goto(`${URL_BASE}/tasks/${TASK_ID}`, { waitUntil: "domcontentloaded" });
await page.waitForSelector("text=Reproduce locally");
await sleep(1200);
await page.screenshot({ path: join(OUT_DIR, "dashboard-overview.png"), type: "png" });

// Scene 2 — graph view, zoomed out one notch so the swimlane reads at a glance.
// Matches the video frame right after the two zoom-out clicks.
await page.getByRole("button", { name: /graph view/i }).click();
await sleep(800);
const zoomOut = page.getByRole("button", { name: /zoom out/i });
await zoomOut.click().catch(() => undefined);
await sleep(400);
await zoomOut.click().catch(() => undefined);
await sleep(900);
await page.screenshot({ path: join(OUT_DIR, "feed-graph.png"), type: "png" });

// Scene 3 — graph view with the verification node selected and the inspector
// populated. Matches the video frame where the inspector first lights up.
// Graph labels are truncated visually but the accessible name carries the
// full title — pick by role+name so the click lands on the VERI node.
await page
  .getByRole("button", { name: /Cart-tax suite green over 50 stress repeats/ })
  .first()
  .click()
  .catch(() => undefined);
await sleep(900);
await page.screenshot({ path: join(OUT_DIR, "inspector.png"), type: "png" });

await context.close();
await browser.close();

process.stdout.write(
  `snapshots: dashboard-overview, feed-graph, inspector → ${OUT_DIR}\n`,
);
