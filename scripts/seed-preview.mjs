#!/usr/bin/env node
/**
 * Seed a curated mock run into a running monitor server, used to populate
 * the dashboard for README preview captures.
 *
 *   1. Start the server pointed at a clean DB:
 *        MONITOR_DATABASE_PATH=.monitor/preview.sqlite \
 *          npm run dev:server
 *   2. Run this script:
 *        node scripts/seed-preview.mjs
 *
 * No real agent activity is touched. All events are synthetic, picked to
 * exercise multiple lanes (user / planning / exploration / implementation
 * / rule) so the swimlane graph and inspector both have something to show.
 */

const BASE = process.env.MONITOR_BASE_URL ?? "http://127.0.0.1:3847";
const TASK_ID = process.env.PREVIEW_TASK_ID ?? "preview-task-checkout-tax";
const SESSION_ID = process.env.PREVIEW_SESSION_ID ?? "preview-session-claude";
const RUNTIME_SOURCE = "claude-code";

const t0 = Date.now() - 4 * 60 * 1000; // run "started" 4 minutes ago
const at = (sec) => new Date(t0 + sec * 1000).toISOString();

async function post(pathname, body) {
  const res = await fetch(`${BASE}${pathname}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`${pathname} → ${res.status} ${await res.text()}`);
  }
  return res.json();
}

await post("/ingest/v1/sessions/ensure", {
  taskId: TASK_ID,
  runtimeSource: RUNTIME_SOURCE,
  runtimeSessionId: SESSION_ID,
  title: "Fix flaky cart-tax integration test",
  workspacePath: "/Users/demo/work/checkout-service",
});

await post("/ingest/v1/tasks/start", {
  taskId: TASK_ID,
  title: "Fix flaky cart-tax integration test",
  workspacePath: "/Users/demo/work/checkout-service",
  runtimeSource: RUNTIME_SOURCE,
  summary: "cart-tax suite fails ~1/5 in CI; investigate and fix",
});

// Don't pass sessionId on events — the schema accepts it but the server
// stores sessions under an internal UUID, not the runtime-side id we used
// to call /sessions/ensure, so passing it would FK-fail. Letting the server
// resolve the session from taskId is the supported path.
const baseEvent = (overrides) => ({
  taskId: TASK_ID,
  metadata: {},
  ...overrides,
});

const events = [
  baseEvent({
    kind: "user.message",
    lane: "user",
    title: "the cart-tax test fails intermittently in CI — can you take a look?",
    body: "Repro is hard locally. CI shows ~1/5 runs red on `cart-tax.spec.ts`.",
    createdAt: at(0),
  }),
  baseEvent({
    kind: "plan.logged",
    lane: "planning",
    title: "Reproduce locally → narrow window → fix",
    body: "1) repeat the suite under stress\n2) bisect to the flaky case\n3) write a deterministic repro\n4) fix and re-run",
    createdAt: at(8),
  }),
  baseEvent({
    kind: "tool.used",
    lane: "exploration",
    title: "Read package.json",
    filePaths: ["package.json"],
    metadata: { tool: "Read", path: "package.json" },
    createdAt: at(18),
  }),
  baseEvent({
    kind: "tool.used",
    lane: "exploration",
    title: "Grep `tax` across src/",
    metadata: { tool: "Grep", pattern: "tax", path: "src" },
    createdAt: at(26),
  }),
  baseEvent({
    kind: "tool.used",
    lane: "exploration",
    title: "Read src/cart-tax.spec.ts",
    filePaths: ["src/cart-tax.spec.ts"],
    metadata: { tool: "Read", path: "src/cart-tax.spec.ts" },
    createdAt: at(34),
  }),
  baseEvent({
    kind: "thought.logged",
    lane: "planning",
    title: "Suspect: race between subtotal recompute and tax memoisation",
    body: "subtotal mutation isn't awaited before the tax selector reads it; under load the selector observes the stale value and the assertion flakes.",
    createdAt: at(48),
  }),
  baseEvent({
    kind: "todo.logged",
    lane: "todos",
    title: "Add deterministic repro test then fix the race",
    metadata: { state: "in_progress" },
    createdAt: at(58),
  }),
  baseEvent({
    kind: "tool.used",
    lane: "implementation",
    title: "Edit src/cart-tax.spec.ts (add deterministic repro)",
    filePaths: ["src/cart-tax.spec.ts"],
    metadata: { tool: "Edit", path: "src/cart-tax.spec.ts" },
    createdAt: at(74),
  }),
  baseEvent({
    kind: "terminal.command",
    lane: "rule",
    title: "npm test -- cart-tax",
    body: "1 failed, 9 passed (deterministic repro reproduces the flake)",
    metadata: { command: "npm test -- cart-tax", exitCode: 1 },
    createdAt: at(92),
  }),
  baseEvent({
    kind: "tool.used",
    lane: "implementation",
    title: "Edit src/cart.ts (await subtotal before tax read)",
    filePaths: ["src/cart.ts"],
    metadata: { tool: "Edit", path: "src/cart.ts" },
    createdAt: at(118),
  }),
  baseEvent({
    kind: "terminal.command",
    lane: "rule",
    title: "npm test -- cart-tax",
    body: "10 passed (10 total)",
    metadata: { command: "npm test -- cart-tax", exitCode: 0 },
    createdAt: at(146),
  }),
  baseEvent({
    kind: "verification.logged",
    lane: "rule",
    title: "Cart-tax suite green over 50 stress repeats",
    body: "ran the suite 50× back to back; no flakes.",
    metadata: { verdict: "passed" },
    createdAt: at(170),
  }),
  baseEvent({
    kind: "terminal.command",
    lane: "rule",
    title: "npm run lint",
    body: "no warnings, no errors",
    metadata: { command: "npm run lint", exitCode: 0 },
    createdAt: at(188),
  }),
  baseEvent({
    kind: "rule.logged",
    lane: "rule",
    title: "Lint + test gate passed",
    metadata: { verdict: "passed", gate: "pre-commit" },
    createdAt: at(196),
  }),
  baseEvent({
    kind: "todo.logged",
    lane: "todos",
    title: "Add deterministic repro test then fix the race",
    metadata: { state: "completed" },
    createdAt: at(204),
  }),
  baseEvent({
    kind: "assistant.response",
    lane: "user",
    title: "Fixed: subtotal is now awaited before the tax selector reads it",
    body: "Root cause was a stale subtotal read. Added a deterministic repro and the fix; lint + tests pass.",
    createdAt: at(216),
  }),
];

// Batch the events at most 100 per request (server limit).
const CHUNK = 100;
for (let i = 0; i < events.length; i += CHUNK) {
  await post("/ingest/v1/events", { events: events.slice(i, i + CHUNK) });
}

process.stdout.write(
  `seed: posted 1 session + 1 task + ${events.length} events to ${BASE}\n` +
    `seed: open the dashboard and select "${TASK_ID}" to see the run.\n`,
);
