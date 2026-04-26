import type { RuntimeIngestEvent } from "~shared/events/kinds.type.js";
import {MonitorRequestError} from "~shared/errors/monitor.js";
import {resolveIngestEndpoint} from "~shared/routing/ingest.routing.js";
import {withTags} from "~shared/semantics/tags.js";
import {resolveMonitorTransportConfig, type MonitorTransportConfig} from "~shared/config/env.js";

export type {RuntimeSessionEnsureResult} from "~shared/transport/transport.type.js";

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

interface ApiErrorEnvelope {
    readonly ok: false;
    readonly error: {
        readonly code: string;
        readonly message: string;
        readonly details?: unknown;
    };
}

function parseEnvelope(body: unknown): ApiErrorEnvelope | undefined {
    if (!isRecord(body) || body["ok"] !== false) return undefined;
    const error = body["error"];
    if (!isRecord(error)) return undefined;
    const code = error["code"];
    const message = error["message"];
    if (typeof code !== "string" || typeof message !== "string") return undefined;
    const details = "details" in error ? error["details"] : undefined;
    return {
        ok: false,
        error: {code, message, ...(details !== undefined ? {details} : {})},
    };
}

function unwrapApiEnvelope<T>(value: unknown): T {
    if (isRecord(value) && value["ok"] === true && "data" in value) {
        return value["data"] as T;
    }
    return value as T;
}

export interface MonitorTransport {
    readonly postJson: <T = Record<string, unknown>>(pathname: string, body: unknown) => Promise<T>;
    readonly postEvent: (events: RuntimeIngestEvent[]) => Promise<void>;
    readonly postTaggedEvent: (event: RuntimeIngestEvent) => Promise<void>;
    readonly postTaggedEvents: (events: RuntimeIngestEvent[]) => Promise<void>;
}

export function createMonitorTransport(
    config: MonitorTransportConfig = resolveMonitorTransportConfig(),
): MonitorTransport {
    async function postJson<T = Record<string, unknown>>(pathname: string, body: unknown): Promise<T> {
        const response = await fetch(`${config.baseUrl}${pathname}`, {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(config.requestTimeoutMs),
        });
        const text = await response.text();
        const parsed = text ? JSON.parse(text) as unknown : {};

        if (!response.ok) {
            const envelope = parseEnvelope(parsed);
            throw new MonitorRequestError({
                status: response.status,
                pathname,
                message: envelope?.error.message ?? `Monitor request failed: ${pathname} (${response.status})`,
                ...(envelope?.error.code !== undefined ? {code: envelope.error.code} : {}),
                ...(envelope?.error.details !== undefined ? {details: envelope.error.details} : {}),
            });
        }

        return unwrapApiEnvelope<T>(parsed);
    }

    async function postEvent(events: RuntimeIngestEvent[]): Promise<void> {
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

    async function postTaggedEvent(event: RuntimeIngestEvent): Promise<void> {
        await postEvent([{...event, metadata: withTags(event.metadata)}]);
    }

    async function postTaggedEvents(events: RuntimeIngestEvent[]): Promise<void> {
        await postEvent(events.map((event) => ({...event, metadata: withTags(event.metadata)})));
    }

    return {postJson, postEvent, postTaggedEvent, postTaggedEvents};
}
