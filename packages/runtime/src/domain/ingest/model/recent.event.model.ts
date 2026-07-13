import type {IngestEvent} from "~runtime/domain/ingest/model/ingest.event.model.js";
import {isRecord} from "~runtime/support/json.js";

/** 태스크 하나가 링에 붙잡아 두는 이벤트 수의 상한이다. */
export const MAX_RECENT_PER_TASK = 200;

/** 힌트와 가드레일이 근거로 삼는 최근 이벤트다. */
export interface RecentEvent {
    readonly id?: string;
    readonly kind: string;
    readonly occurredAt: string;
    readonly sessionId?: string;
    readonly turnId?: string;
    readonly title?: string;
    readonly body?: string;
    readonly toolName?: string;
    readonly filePaths?: readonly string[];
    readonly metadata: Record<string, unknown>;
}

export interface RecentTaskStats {
    readonly taskId: string;
    readonly events: number;
    readonly lastOccurredAt?: string;
}

export interface RecentEventStats {
    readonly taskCount: number;
    readonly eventCount: number;
    readonly maxPerTask: number;
    readonly byKind: Record<string, number>;
    readonly tasks: readonly RecentTaskStats[];
}

/** 원장으로 나가는 이벤트를 힌트와 가드레일이 읽는 형태로 좁힌다. */
export function toRecentEvent(event: IngestEvent): RecentEvent {
    const payload = isRecord(event.payload) ? event.payload : {};
    const metadataValue = payload["metadata"];
    return {
        kind: event.kind,
        occurredAt: event.occurredAt,
        metadata: isRecord(metadataValue) ? metadataValue : {},
        ...(event.id ? {id: event.id} : {}),
        ...(event.sessionId ? {sessionId: event.sessionId} : {}),
        ...(event.turnId ? {turnId: event.turnId} : {}),
        ...readString(payload, "title"),
        ...readString(payload, "body"),
        ...readString(payload, "toolName"),
        ...readFilePaths(payload),
    };
}

/** 태스크별 최근 이벤트를 상한까지만 메모리에 유지한다. */
export class RecentEventRing {
    private readonly byTask = new Map<string, RecentEvent[]>();

    observe(event: IngestEvent): void {
        if (!event.taskId) return;
        const list = this.byTask.get(event.taskId) ?? [];
        list.push(toRecentEvent(event));
        if (list.length > MAX_RECENT_PER_TASK) list.splice(0, list.length - MAX_RECENT_PER_TASK);
        this.byTask.set(event.taskId, list);
    }

    recent(taskId: string): readonly RecentEvent[] {
        return this.byTask.get(taskId) ?? [];
    }

    stats(): RecentEventStats {
        const byKind: Record<string, number> = {};
        const tasks: RecentTaskStats[] = [];
        for (const [taskId, events] of this.byTask) {
            for (const event of events) byKind[event.kind] = (byKind[event.kind] ?? 0) + 1;
            const last = events[events.length - 1];
            tasks.push({
                taskId,
                events: events.length,
                ...(last !== undefined ? {lastOccurredAt: last.occurredAt} : {}),
            });
        }
        tasks.sort((left, right) => right.events - left.events);
        return {
            taskCount: this.byTask.size,
            eventCount: tasks.reduce((sum, task) => sum + task.events, 0),
            maxPerTask: MAX_RECENT_PER_TASK,
            byKind,
            tasks,
        };
    }
}

function readString(payload: Record<string, unknown>, key: string): Record<string, string> {
    const value = payload[key];
    return typeof value === "string" ? {[key]: value} : {};
}

function readFilePaths(payload: Record<string, unknown>): {filePaths?: readonly string[]} {
    const value = payload["filePaths"];
    if (!Array.isArray(value)) return {};
    const items = value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
    return items.length > 0 ? {filePaths: items} : {};
}
