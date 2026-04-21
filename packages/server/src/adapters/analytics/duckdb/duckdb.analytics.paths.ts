import os from "node:os";
import path from "node:path";

const DEFAULT_ANALYTICS_DIR = path.join(os.homedir(), ".agent-tracer");

function trimString(value: unknown): string {
    return typeof value === "string" ? value.trim() : "";
}

export function resolveDuckDbAnalyticsPath(env: NodeJS.ProcessEnv = process.env): string {
    const explicit = trimString(env["AGENT_TRACER_ANALYTICS_PATH"]);
    return explicit || path.join(DEFAULT_ANALYTICS_DIR, "analytics.duckdb");
}

export function resolveDuckDbArchiveDir(env: NodeJS.ProcessEnv = process.env): string {
    const explicit = trimString(env["AGENT_TRACER_ARCHIVE_DIR"]);
    return explicit || path.join(DEFAULT_ANALYTICS_DIR, "archive", "events");
}

export function resolveDuckDbPortableDir(env: NodeJS.ProcessEnv = process.env): string {
    const explicit = trimString(env["AGENT_TRACER_ANALYTICS_PORTABLE_DIR"]);
    return explicit || path.join(DEFAULT_ANALYTICS_DIR, "portable", "analytics");
}

export function resolveAnalyticsEtlIntervalMs(env: NodeJS.ProcessEnv = process.env): number {
    const parsed = Number(env["AGENT_TRACER_ANALYTICS_ETL_INTERVAL_MS"]);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 60 * 60 * 1000;
}

export function resolveAnalyticsArchiveAfterDays(env: NodeJS.ProcessEnv = process.env): number {
    const parsed = Number(env["AGENT_TRACER_ANALYTICS_ARCHIVE_AFTER_DAYS"]);
    return Number.isFinite(parsed) && parsed >= 1 ? parsed : 90;
}

export function isAnalyticsDisabled(env: NodeJS.ProcessEnv = process.env): boolean {
    const value = trimString(env["AGENT_TRACER_ANALYTICS_DISABLED"]).toLowerCase();
    return value === "1" || value === "true" || value === "yes";
}
