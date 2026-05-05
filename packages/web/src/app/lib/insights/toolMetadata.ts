/**
 * Inspector-side formatters for runtime-captured tool input metadata and
 * cross-check markers.
 *
 * Privacy contract: tool result content (stdout/stderr/file body/web body) is
 * never captured upstream, so there is no formatter here for result data.
 * Only the agent's *action* (Read range, Grep flags, WebFetch prompt, etc.)
 * is surfaced.
 */
import type { TimelineEventRecord } from "~domain/monitoring.js";

interface MetadataRecord {
    readonly [key: string]: unknown;
}

function asNumber(value: unknown): number | undefined {
    return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function asString(value: unknown): string | undefined {
    return typeof value === "string" && value.length > 0 ? value : undefined;
}

function asBoolean(value: unknown): boolean | undefined {
    return typeof value === "boolean" ? value : undefined;
}

function asRecord(value: unknown): MetadataRecord | undefined {
    if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
    return value as MetadataRecord;
}

export function formatToolInputExtras(event: Pick<TimelineEventRecord, "metadata">): string | null {
    const md = event.metadata;
    const lines: string[] = [];
    const readOffset = asNumber(md["readOffset"]);
    const readLimit = asNumber(md["readLimit"]);
    if (readOffset !== undefined || readLimit !== undefined) {
        const start = readOffset ?? 1;
        const range = readLimit !== undefined ? `${start}–${start + readLimit - 1}` : `${start}+`;
        lines.push(`Read range: lines ${range}`);
    }
    const grepOutputMode = asString(md["grepOutputMode"]);
    if (grepOutputMode) lines.push(`Grep output mode: ${grepOutputMode}`);
    const grepGlob = asString(md["searchGlob"]);
    if (grepGlob) lines.push(`Grep glob filter: ${grepGlob}`);
    if (asBoolean(md["grepCaseInsensitive"])) lines.push("Case insensitive: true");
    if (asBoolean(md["grepMultiline"])) lines.push("Multiline: true");
    const webPrompt = asString(md["webPrompt"]);
    if (webPrompt) lines.push(`Fetch prompt: ${webPrompt}`);
    const allowed = Array.isArray(md["webAllowedDomains"]) ? md["webAllowedDomains"] : [];
    const blocked = Array.isArray(md["webBlockedDomains"]) ? md["webBlockedDomains"] : [];
    if (allowed.length > 0) lines.push(`Allowed domains: ${allowed.join(", ")}`);
    if (blocked.length > 0) lines.push(`Blocked domains: ${blocked.join(", ")}`);
    const timeoutMs = asNumber(md["timeoutMs"]);
    if (timeoutMs !== undefined) lines.push(`Timeout: ${timeoutMs.toLocaleString()}ms`);
    if (asBoolean(md["runInBackground"])) lines.push("Run in background: true");
    if (asBoolean(md["editReplaceAll"])) lines.push("Edit replace_all: true");
    return lines.length > 0 ? lines.join("\n") : null;
}

export function formatCrossCheckMarker(event: Pick<TimelineEventRecord, "metadata">): string | null {
    const cc = asRecord(event.metadata["crossCheck"]);
    if (!cc) return null;
    const source = asString(cc["source"]);
    const dedupeKey = asString(cc["dedupeKey"]);
    const merged = asBoolean(cc["merged"]);
    const lines: string[] = [];
    if (source) lines.push(`Source: ${source}`);
    if (dedupeKey) lines.push(`Dedupe key: ${dedupeKey}`);
    if (merged) lines.push("Merged: hook + rollout observations agree on this event.");
    return lines.length > 0 ? lines.join("\n") : null;
}
