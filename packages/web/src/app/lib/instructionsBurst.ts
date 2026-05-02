import { EventId } from "~domain/monitoring.js";
import type { TimelineEventRecord } from "~domain/monitoring.js";

export interface InstructionsBurstFile {
    readonly eventId: string;
    readonly relPath: string;
    readonly filePath: string;
    readonly loadReason: string;
    readonly memoryType: string;
    readonly createdAt: string;
    readonly title: string;
}

export interface GroupInstructionsBurstsOptions {
    readonly windowMs?: number;
    readonly minBurstSize?: number;
}

const DEFAULT_WINDOW_MS = 3000;
const DEFAULT_MIN_BURST_SIZE = 3;
const BODY_PREVIEW_LIMIT = 12;

function isInstructionsBurstEvent(event: TimelineEventRecord): boolean {
    return event.metadata["instructionsBurst"] === true;
}

function getInstructionsBurstFiles(
    event: TimelineEventRecord
): readonly InstructionsBurstFile[] {
    const raw = event.metadata["files"];
    if (!Array.isArray(raw)) return [];
    return raw.filter((item): item is InstructionsBurstFile => {
        if (!item || typeof item !== "object") return false;
        const candidate = item as Record<string, unknown>;
        return (
            typeof candidate["relPath"] === "string" &&
            typeof candidate["createdAt"] === "string"
        );
    });
}

export function groupInstructionsBursts(
    events: readonly TimelineEventRecord[],
    options: GroupInstructionsBurstsOptions = {}
): readonly TimelineEventRecord[] {
    const windowMs = options.windowMs ?? DEFAULT_WINDOW_MS;
    const minBurstSize = options.minBurstSize ?? DEFAULT_MIN_BURST_SIZE;
    if (events.length < minBurstSize) return events;

    const sorted = [...events].sort(
        (a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt)
    );
    const result: TimelineEventRecord[] = [];
    let i = 0;
    while (i < sorted.length) {
        const event = sorted[i];
        if (!event) {
            i++;
            continue;
        }
        if (!isGroupableInstruction(event)) {
            result.push(event);
            i++;
            continue;
        }
        const burst: TimelineEventRecord[] = [event];
        let j = i + 1;
        let anchorMs = Date.parse(event.createdAt);
        while (j < sorted.length) {
            const next = sorted[j];
            if (!next || !isGroupableInstruction(next)) break;
            const nextMs = Date.parse(next.createdAt);
            if (nextMs - anchorMs > windowMs) break;
            burst.push(next);
            anchorMs = nextMs;
            j++;
        }
        if (burst.length >= minBurstSize) {
            result.push(buildBurstEvent(burst));
        } else {
            for (const item of burst) result.push(item);
        }
        i = j;
    }
    return result;
}

function isGroupableInstruction(event: TimelineEventRecord): boolean {
    return event.kind === "instructions.loaded" && !isInstructionsBurstEvent(event);
}

function buildBurstEvent(burst: readonly TimelineEventRecord[]): TimelineEventRecord {
    const first = burst[0];
    const last = burst[burst.length - 1];
    if (!first || !last) {
        // Unreachable: caller guarantees burst.length >= minBurstSize >= 1.
        throw new Error("buildBurstEvent called with empty burst");
    }
    const files: InstructionsBurstFile[] = burst.map((event) => ({
        eventId: event.id,
        relPath: pickString(event.metadata["relPath"], event.body ?? event.title),
        filePath: pickString(event.metadata["filePath"], event.body ?? event.title),
        loadReason: pickString(event.metadata["loadReason"], "unknown"),
        memoryType: pickString(event.metadata["memoryType"], "unknown"),
        createdAt: event.createdAt,
        title: event.title
    }));
    const reasonCounts = countField(files, (file) => file.loadReason);
    const memoryCounts = countField(files, (file) => file.memoryType);
    const reasonKeys = [...reasonCounts.keys()];
    const reasonSuffix = reasonKeys.length === 1 && reasonKeys[0] !== "unknown"
        ? ` · ${reasonKeys[0]}`
        : "";
    const bodyLines = files.slice(0, BODY_PREVIEW_LIMIT).map((file) => `• ${file.relPath}`);
    if (files.length > BODY_PREVIEW_LIMIT) {
        bodyLines.push(`… +${files.length - BODY_PREVIEW_LIMIT} more`);
    }
    const syntheticId = `instructions-burst:${first.id}:${last.id}`;
    return {
        id: EventId(syntheticId),
        taskId: first.taskId,
        ...(first.sessionId ? { sessionId: first.sessionId } : {}),
        kind: "instructions.loaded",
        lane: first.lane,
        title: `Instructions batch (${files.length}${reasonSuffix})`,
        body: bodyLines.join("\n"),
        metadata: {
            instructionsBurst: true,
            burstSize: files.length,
            files,
            firstCreatedAt: first.createdAt,
            lastCreatedAt: last.createdAt,
            loadReasonCounts: Object.fromEntries(reasonCounts),
            memoryTypeCounts: Object.fromEntries(memoryCounts)
        },
        classification: first.classification,
        createdAt: first.createdAt
    };
}

function pickString(value: unknown, fallback: string): string {
    return typeof value === "string" && value.length > 0 ? value : fallback;
}

function countField<T>(
    items: readonly T[],
    key: (item: T) => string
): Map<string, number> {
    const counts = new Map<string, number>();
    for (const item of items) {
        const value = key(item);
        counts.set(value, (counts.get(value) ?? 0) + 1);
    }
    return counts;
}
