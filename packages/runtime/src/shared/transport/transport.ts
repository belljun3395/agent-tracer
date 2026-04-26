import type {RuntimeIngestEvent} from "~shared/events/kinds.js";
import {resolveIngestEndpoint} from "~shared/routing/ingest.routing.js";

export type {RuntimeSessionEnsureResult} from "~shared/transport/transport.type.js";

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function unwrapApiEnvelope<T>(value: unknown): T {
    if (isRecord(value) && value["ok"] === true && "data" in value) {
        return value["data"] as T;
    }
    return value as T;
}

// Resolves the monitor base URL from environment variables, falling back to
// http://127.0.0.1:3847. MONITOR_BASE_URL takes priority; otherwise
// MONITOR_PUBLIC_HOST and MONITOR_PORT are used.
function resolveApiBase(): string {
    const explicit = (process.env.MONITOR_BASE_URL ?? "").trim();
    if (explicit) return explicit.replace(/\/$/, "");
    const port = parseInt(process.env.MONITOR_PORT ?? "", 10) || 3847;
    const host = (process.env.MONITOR_PUBLIC_HOST ?? "127.0.0.1").trim();
    return `http://${host}:${port}`;
}
/**
 * POSTs a JSON body to the monitor API at the resolved base URL.
 * Enforces a 2-second timeout. Throws on network error or non-2xx response.
 */
export async function postJson<T = Record<string, unknown>>(pathname: string, body: unknown): Promise<T> {
    const response = await fetch(`${resolveApiBase()}${pathname}`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(2000),
    });
    if (!response.ok) {
        throw new Error(`Monitor request failed: ${pathname} (${response.status})`);
    }
    const text = await response.text();
    return unwrapApiEnvelope<T>(text ? JSON.parse(text) as unknown : {});
}

/**
 * Groups events by their resolved ingest endpoint and fires one POST per group.
 * No tags are applied to the event metadata.
 */
export async function postEvent(events: RuntimeIngestEvent[]): Promise<void> {
    const groups = new Map<string, RuntimeIngestEvent[]>();
    for (const event of events) {
        const endpoint = resolveIngestEndpoint(event.kind);
        const group = groups.get(endpoint) ?? [];
        group.push(event);
        groups.set(endpoint, group);
    }
    await Promise.all(
        [...groups.entries()].map(([endpoint, batch]) => postJson(endpoint, {events: batch})),
    );
}
