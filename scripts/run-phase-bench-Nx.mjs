#!/usr/bin/env node
// Run benchmark-phases-docker.mjs N times and pick the median run by
// avgHookP99Ms across all phases. Prints the median run's summary path
// so the docs commit can pin a specific artifact.
//
// Usage:
//   node scripts/run-phase-bench-Nx.mjs --runs 5 -- --iterations 200 --warmup 20
//
// All args after `--` are forwarded to benchmark-phases-docker.mjs.
// `--runs N` is consumed by this runner and defaults to 5.

import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

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

// Parse --runs out of argv; everything else passes through.
const argv = process.argv.slice(2);
let RUNS = 5;
const passthrough = [];
for (let i = 0; i < argv.length; i += 1) {
  const arg = argv[i];
  if (arg === "--runs") {
    RUNS = parseInt(argv[++i] ?? "5", 10);
  } else if (arg.startsWith("--runs=")) {
    RUNS = parseInt(arg.slice("--runs=".length), 10);
  } else if (arg !== "--") {
    passthrough.push(arg);
  }
}
if (!Number.isFinite(RUNS) || RUNS < 1) throw new Error(`--runs must be >= 1`);

const runs = [];
for (let i = 0; i < RUNS; i += 1) {
  console.log(`\n############# RUN ${i + 1} / ${RUNS} #############\n`);
  const before = listResultDirs();
  const res = spawnSync("node", [benchScript, ...passthrough], {
    cwd: repoRoot,
    stdio: "inherit",
  });
  if (res.status !== 0) throw new Error(`Run ${i + 1} failed with status ${res.status}`);
  const after = listResultDirs();
  const newDir = after.find((d) => !before.includes(d));
  if (!newDir) throw new Error(`Could not detect new result dir for run ${i + 1}`);
  const summaryPath = path.join(resultRoot, newDir, `docker-phase-summary-${newDir}.json`);
  const summary = JSON.parse(readFileSync(summaryPath, "utf8"));
  const score = avg(summary.results.map((r) => r.avgHookP99Ms));
  runs.push({ index: i + 1, dir: newDir, summaryPath, score, summary });
  console.log(`\n→ run ${i + 1} score: ${round(score)} ms (avg of phase avgHookP99Ms)`);
}

const sorted = [...runs].sort((a, b) => a.score - b.score);
// True median by index: for odd N, middle element; for even N, average two middle scores
// but pick the lower middle for the artifact.
const median = sorted[Math.floor((sorted.length - 1) / 2)];

console.log(`\n============= ${RUNS}-RUN SUMMARY =============`);
for (const r of runs) {
  const tag = r === median ? " ← MEDIAN" : "";
  console.log(`run ${r.index}: ${r.dir} | score ${round(r.score)} ms${tag}`);
}
const scores = runs.map((r) => r.score);
const meanScore = avg(scores);
const stdScore = stddev(scores);
console.log(`\nMean ± stddev: ${round(meanScore)} ± ${round(stdScore)} ms (n=${runs.length})`);
console.log(`Median artifact: ${median.summaryPath}`);
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
function stddev(xs) {
  const ys = xs.filter(Number.isFinite);
  if (ys.length < 2) return 0;
  const m = avg(ys);
  const v = ys.reduce((s, x) => s + (x - m) ** 2, 0) / (ys.length - 1);
  return Math.sqrt(v);
}
function round(v) { return Number.isFinite(v) ? Math.round(v * 100) / 100 : 0; }
