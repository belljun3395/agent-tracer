import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceDir = process.env.AGENT_TRACER_ANALYTICS_PORTABLE_DIR
  || path.join(os.homedir(), ".agent-tracer", "portable", "analytics");
const targetDir = path.join(packageRoot, "sources", "agent_tracer", "data");
const evidenceDataDir = path.join(packageRoot, ".evidence", "template", "static", "data");
const rootStaticDataDir = path.join(packageRoot, "static", "data");

const watchMode = process.env.SYNC_WATCH_MODE === "true";

const requiredFiles = [
  "fact_task_summary.parquet",
  "fact_sessions.parquet",
  "fact_tool_calls.parquet",
  "fact_evaluations.parquet",
  "fact_task_context.parquet",
  "fact_turn_tokens.parquet",
  "dim_task.parquet",
  "dim_tool.parquet",
  "dim_time.parquet",
];

fs.mkdirSync(targetDir, { recursive: true });

const missingFiles = requiredFiles.filter((fileName) => !fs.existsSync(path.join(sourceDir, fileName)));
if (missingFiles.length > 0) {
  const targetHasFiles = requiredFiles.every((fileName) => fs.existsSync(path.join(targetDir, fileName)));
  if (targetHasFiles) {
    syncEvidenceStaticData();
    console.log(`Using existing portable analytics files in ${targetDir}`);
    process.exit(0);
  }

  throw new Error([
    `Missing portable analytics parquet files in ${sourceDir}.`,
    "Run the monitor server once or run DuckDB ETL before starting Evidence.",
    `Missing: ${missingFiles.join(", ")}`,
  ].join("\n"));
}

// In watch mode skip sources/ to avoid triggering Evidence's plugin reload cycle
if (!watchMode) {
  for (const fileName of requiredFiles) {
    fs.copyFileSync(path.join(sourceDir, fileName), path.join(targetDir, fileName));
  }
}

syncEvidenceStaticData();

console.log(`Synced ${requiredFiles.length} portable analytics files from ${sourceDir}`);

function syncEvidenceStaticData() {
  if (!watchMode) {
    fs.rmSync(evidenceDataDir, { recursive: true, force: true });
  }
  fs.mkdirSync(evidenceDataDir, { recursive: true });

  const renderedFiles = [];
  for (const fileName of requiredFiles) {
    const queryName = fileName.replace(/\.parquet$/u, "");
    const queryDir = path.join(evidenceDataDir, "agent_tracer", queryName);
    const queryParquet = path.join(queryDir, fileName);
    const portableParquet = watchMode
      ? path.join(sourceDir, fileName)
      : path.join(targetDir, fileName);
    if (!fs.existsSync(portableParquet)) continue;

    fs.mkdirSync(queryDir, { recursive: true });
    fs.copyFileSync(portableParquet, queryParquet);
    renderedFiles.push(`static/data/agent_tracer/${queryName}/${fileName}`);
  }

  fs.writeFileSync(
    path.join(evidenceDataDir, "manifest.json"),
    JSON.stringify({ renderedFiles: { agent_tracer: renderedFiles } }),
  );

  const manifestPath = path.join(evidenceDataDir, "manifest.json");
  if (!fs.existsSync(manifestPath)) return;

  if (!watchMode) {
    fs.rmSync(rootStaticDataDir, { recursive: true, force: true });
  }
  fs.mkdirSync(rootStaticDataDir, { recursive: true });
  fs.cpSync(evidenceDataDir, rootStaticDataDir, { recursive: true });
}
