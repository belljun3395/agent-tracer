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

await page.goto(`${URL_BASE}/tasks`, { waitUntil: "domcontentloaded" });
await page.waitForSelector("text=cart-tax");
await sleep(900);

await page.goto(`${URL_BASE}/tasks/${TASK_ID}`, { waitUntil: "domcontentloaded" });
await page.waitForSelector("text=Reproduce locally");
await sleep(1500);

// Pause on the feed for a beat so viewers can read the lanes.
await sleep(2200);

// Click an event card to populate the inspector.
await page
  .locator("text=Cart-tax suite green over 50 stress repeats")
  .first()
  .click();
await sleep(2200);

// Switch to graph view to show the swimlane layout.
await page.getByRole("button", { name: /graph view/i }).click();
await sleep(2400);

// Highlight a node in the graph.
await page
  .locator("text=Cart-tax suite green over 50 stress")
  .first()
  .click()
  .catch(() => undefined);
await sleep(2200);

// Back to feed for a clean closing frame.
await page.getByRole("button", { name: /feed view/i }).click();
await sleep(1800);

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
