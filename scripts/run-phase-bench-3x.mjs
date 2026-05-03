#!/usr/bin/env node
// Run benchmark-phases-docker.mjs three times and pick the median run by
// avgHookP99Ms across all phases. Prints the median run's summary path
// so the docs commit can pin a specific artifact.
//
// Usage: node scripts/run-phase-bench-3x.mjs [-- <bench args>]

import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

// Resolve to MAIN repo (where the bench writes its results), even when
// invoked from inside a worktree. Uses git's common-dir like the bench script.
const localRoot = path.resolve(import.meta.dirname, "..");
const repoRoot = (() => {
  const res = spawnSync("git", ["rev-parse", "--git-common-dir"], { cwd: localRoot, encoding: "utf8" });
  if (res.status === 0 && res.stdout.trim()) {
    return path.resolve(localRoot, res.stdout.trim(), "..");
  }
  return localRoot;
})();
const benchScript = path.join(localRoot, "scripts/benchmark-phases-docker.mjs");
const resultRoot = path.join(repoRoot, "observability/results/docker-phase-bench");

const passthroughArgs = process.argv.slice(2).filter((arg) => arg !== "--");
const RUNS = 3;

const runs = [];
for (let i = 0; i < RUNS; i += 1) {
  console.log(`\n############# RUN ${i + 1} / ${RUNS} #############\n`);
  const before = listResultDirs();
  const res = spawnSync("node", [benchScript, ...passthroughArgs], {
    cwd: repoRoot,
    stdio: "inherit",
  });
  if (res.status !== 0) throw new Error(`Run ${i + 1} failed with status ${res.status}`);
  const after = listResultDirs();
  const newDir = after.find((d) => !before.includes(d));
  if (!newDir) throw new Error(`Could not detect new result dir for run ${i + 1}`);
  const summaryPath = path.join(resultRoot, newDir, `docker-phase-summary-${newDir}.json`);
  const summary = JSON.parse(readFileSync(summaryPath, "utf8"));
  // Composite "score" used to pick the median run: average of avgHookP99Ms across all phases.
  const score = avg(summary.results.map((r) => r.avgHookP99Ms));
  runs.push({ index: i + 1, dir: newDir, summaryPath, score, summary });
  console.log(`\n→ run ${i + 1} score: ${round(score)} ms (avg of phase avgHookP99Ms)`);
}

const sorted = [...runs].sort((a, b) => a.score - b.score);
const median = sorted[Math.floor(sorted.length / 2)];

console.log("\n============= 3-RUN SUMMARY =============");
for (const r of runs) {
  const tag = r === median ? " ← MEDIAN" : "";
  console.log(`run ${r.index}: ${r.dir} | score ${round(r.score)} ms${tag}`);
}
console.log(`\nMedian artifact: ${median.summaryPath}`);
console.log("\nMedian per-phase results:");
for (const phase of median.summary.results) {
  console.log(`  ${phase.phase}: avg p99 ${phase.avgHookP99Ms} ms`);
}

function listResultDirs() {
  try {
    return readdirSync(resultRoot).filter((d) => {
      try { return statSync(path.join(resultRoot, d)).isDirectory(); } catch { return false; }
    });
  } catch { return []; }
}
function avg(xs) { const ys = xs.filter(Number.isFinite); return ys.length ? ys.reduce((a, b) => a + b, 0) / ys.length : 0; }
function round(v) { return Number.isFinite(v) ? Math.round(v * 100) / 100 : 0; }
