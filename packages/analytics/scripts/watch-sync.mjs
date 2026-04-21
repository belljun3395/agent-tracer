import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const scriptPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "sync-portable-data.mjs",
);

const intervalMs = Number(process.env.AGENT_TRACER_ANALYTICS_ETL_INTERVAL_MS) || 10000;

function runSync() {
  const child = spawn(process.execPath, [scriptPath], {
  stdio: "inherit",
  env: { ...process.env, SYNC_WATCH_MODE: "true" },
});
  child.on("error", () => {});
}

setInterval(runSync, intervalMs);
console.log(`[watch-sync] syncing every ${intervalMs}ms`);
