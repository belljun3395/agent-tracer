#!/usr/bin/env node
/**
 * Benchmark Claude Code hook runner wall-clock latency.
 *
 * This intentionally measures outside the hook process so it captures the full
 * cost Claude Code pays: shell runner + node/tsx startup + hook body + transport.
 * Use the same script on AS-IS, phase2, phase3, and phase2+3 worktrees.
 */
import { spawn } from "node:child_process";
import { mkdir, writeFile, appendFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const repoRoot = path.resolve(import.meta.dirname, "..");

const options = parseArgs(process.argv.slice(2));
const hookName = stringOption(options, "hook", "PreToolUse");
const iterations = intOption(options, "iterations", 100);
const warmup = intOption(options, "warmup", 10);
const concurrency = intOption(options, "concurrency", 1);
const outDir = path.resolve(repoRoot, stringOption(options, "out-dir", "observability/results"));
const runner = path.resolve(repoRoot, stringOption(options, "runner", "packages/runtime/src/claude-code/bin/run-hook.sh"));
const payloadFile = options["payload-file"] ? path.resolve(repoRoot, String(options["payload-file"])) : undefined;
const label = stringOption(options, "label", currentTimestampLabel());
const totalRuns = warmup + iterations;

if (iterations < 1) throw new Error("--iterations must be >= 1");
if (warmup < 0) throw new Error("--warmup must be >= 0");
if (concurrency < 1) throw new Error("--concurrency must be >= 1");

await mkdir(outDir, { recursive: true });
const samplesPath = path.join(outDir, `${label}-${sanitize(hookName)}-samples.ndjson`);
const summaryPath = path.join(outDir, `${label}-${sanitize(hookName)}-summary.json`);
await writeFile(samplesPath, "");

const startedAt = new Date().toISOString();
const samples = [];
let nextIndex = 0;

await Promise.all(Array.from({ length: concurrency }, async () => {
  while (nextIndex < totalRuns) {
    const index = nextIndex++;
    const sample = await runOne(index);
    await appendFile(samplesPath, JSON.stringify(sample) + "\n");
    if (!sample.warmup) samples.push(sample);
  }
}));

const summary = summarize(samples, {
  label,
  hookName,
  runner,
  iterations,
  warmup,
  concurrency,
  startedAt,
  finishedAt: new Date().toISOString(),
  samplesPath,
});
await writeFile(summaryPath, JSON.stringify(summary, null, 2) + "\n");

process.stdout.write(JSON.stringify(summary, null, 2) + "\n");

async function runOne(index) {
  const payload = payloadFile
    ? await readPayloadFile(payloadFile, index)
    : defaultPayload(hookName, index);
  const started = process.hrtime.bigint();
  const child = spawn(runner, [hookName], {
    cwd: repoRoot,
    env: {
      ...process.env,
      NODE_ENV: process.env.NODE_ENV ?? "production",
      CLAUDE_PLUGIN_ROOT: path.resolve(repoRoot, "packages/runtime/src/claude-code"),
      CLAUDE_PROJECT_DIR: process.env.CLAUDE_PROJECT_DIR ?? repoRoot,
    },
    stdio: ["pipe", "pipe", "pipe"],
  });

  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => { stdout += chunk; });
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  child.stdin.end(JSON.stringify(payload));

  const { exitCode, signal } = await new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (code, sig) => resolve({ exitCode: code, signal: sig }));
  });
  const ended = process.hrtime.bigint();

  return {
    index,
    warmup: index < warmup,
    hookName,
    durationMs: Number(ended - started) / 1_000_000,
    exitCode,
    signal,
    stdoutBytes: Buffer.byteLength(stdout),
    stderrBytes: Buffer.byteLength(stderr),
    stderrTail: stderr.trim().slice(-500) || undefined,
  };
}

async function readPayloadFile(file, index) {
  const raw = await import("node:fs/promises").then((fs) => fs.readFile(file, "utf8"));
  const parsed = JSON.parse(raw);
  return withIndex(parsed, index);
}

function defaultPayload(hook, index) {
  const sessionId = `bench-${process.env.USER ?? "user"}-${process.pid}`;
  const base = {
    session_id: sessionId,
    transcript_path: path.join(repoRoot, "observability", "results", "benchmark-transcript.jsonl"),
    cwd: repoRoot,
    permission_mode: "default",
    model: "benchmark-model",
  };

  if (hook === "SessionStart") {
    return withIndex({
      ...base,
      hook_event_name: "SessionStart",
      source: "startup",
    }, index);
  }

  if (hook === "StatusLine") {
    return withIndex({
      ...base,
      version: "benchmark",
      model: { id: "benchmark-model", display_name: "Benchmark" },
      context_window: {
        used_percentage: 42,
        remaining_percentage: 58,
        total_input_tokens: 1000,
        total_output_tokens: 100,
        context_window_size: 200000,
        current_usage: { input_tokens: 10, output_tokens: 5 },
      },
      cost: { total_cost_usd: 0.001 },
    }, index);
  }

  return withIndex({
    ...base,
    hook_event_name: hook,
    tool_name: "Bash",
    tool_use_id: `tool-${index}`,
    tool_input: { command: "true", description: "benchmark no-op" },
  }, index);
}

function withIndex(payload, index) {
  return {
    ...payload,
    session_id: `${payload.session_id}-${index}`,
    benchmark_index: index,
  };
}

function summarize(records, meta) {
  const durations = records.map((record) => record.durationMs).sort((a, b) => a - b);
  const failed = records.filter((record) => record.exitCode !== 0 || record.signal !== null);
  return {
    ...meta,
    count: records.length,
    failures: failed.length,
    durationMs: {
      min: round(durations[0]),
      p50: round(percentile(durations, 0.50)),
      p95: round(percentile(durations, 0.95)),
      p99: round(percentile(durations, 0.99)),
      max: round(durations[durations.length - 1]),
      avg: round(durations.reduce((sum, value) => sum + value, 0) / durations.length),
    },
  };
}

function percentile(sortedValues, p) {
  if (sortedValues.length === 0) return NaN;
  const rank = (sortedValues.length - 1) * p;
  const lower = Math.floor(rank);
  const upper = Math.ceil(rank);
  if (lower === upper) return sortedValues[lower];
  const weight = rank - lower;
  return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
}

function parseArgs(args) {
  const parsed = {};
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (!arg.startsWith("--")) continue;
    const eq = arg.indexOf("=");
    if (eq >= 0) {
      parsed[arg.slice(2, eq)] = arg.slice(eq + 1);
    } else {
      const key = arg.slice(2);
      const next = args[i + 1];
      if (next && !next.startsWith("--")) {
        parsed[key] = next;
        i += 1;
      } else {
        parsed[key] = "true";
      }
    }
  }
  return parsed;
}

function stringOption(options, key, fallback) {
  const value = options[key];
  return value === undefined || value === "" ? fallback : String(value);
}

function intOption(options, key, fallback) {
  const value = options[key];
  if (value === undefined || value === "") return fallback;
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed)) throw new Error(`--${key} must be an integer`);
  return parsed;
}

function currentTimestampLabel() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function sanitize(value) {
  return value.replace(/[^a-zA-Z0-9_.-]+/g, "-");
}

function round(value) {
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : null;
}
