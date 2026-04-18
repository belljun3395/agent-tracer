import { EventId, type EventId as MonitorEventId, type MonitoringEventKind, type SessionId, type SessionId as MonitorSessionId, type TimelineEvent } from "@monitor/domain";
import { classifyEvent } from "@monitor/classification";
import type { IEventRepository } from "../ports";
import type { INotificationPublisher } from "../ports";
import type { GenericEventInput } from "../types.js";
import { TraceMetadataFactory } from "./trace-metadata-factory.js";
import { MAX_DERIVED_FILES } from "./event-recorder.constants.js";
import { normalizeFilePaths } from "./event-recorder.helpers.js";
export class EventRecorder {
    constructor(private readonly events: IEventRepository, private readonly notifier: INotificationPublisher) { }
    private withSessionId(sessionId?: SessionId): {
        sessionId?: SessionId;
    } {
        return sessionId ? { sessionId } : {};
    }
    async record(input: GenericEventInput): Promise<TimelineEvent> {
        const createdAt = input.createdAt ?? new Date().toISOString();
        const filePaths = normalizeFilePaths(input.filePaths);
        const classification = classifyEvent({
            kind: input.kind,
            title: input.title,
            ...(input.lane ? { lane: input.lane } : {}),
            ...(input.body ? { body: input.body } : {}),
            ...(input.command ? { command: input.command } : {}),
            ...(input.toolName ? { toolName: input.toolName } : {}),
            ...(input.actionName ? { actionName: input.actionName } : {}),
            ...(filePaths.length > 0 ? { filePaths } : {})
        });
        const contextualTags = TraceMetadataFactory.deriveTags(input);
        const event = await this.events.insert({
            id: EventId(globalThis.crypto.randomUUID()),
            taskId: input.taskId,
            kind: input.kind,
            lane: classification.lane,
            title: input.title,
            metadata: TraceMetadataFactory.build({
                ...(input.metadata ?? {}),
                filePaths
            }, input),
            classification: {
                ...classification,
                tags: [...new Set([...classification.tags, ...contextualTags])]
            },
            createdAt,
            ...this.withSessionId(input.sessionId),
            ...(input.body ? { body: input.body } : {})
        });
        this.notifier.publish({ type: "event.logged", payload: event });
        return event;
    }
    async recordWithDerivedFiles(input: GenericEventInput): Promise<{
        sessionId?: MonitorSessionId;
        events: readonly {
            id: MonitorEventId;
            kind: MonitoringEventKind;
        }[];
    }> {
        const filePaths = normalizeFilePaths(input.filePaths);
        const primaryEvent = await this.record({
            ...input,
            ...(filePaths.length > 0 ? { filePaths } : {})
        });
        if (primaryEvent.lane === "exploration" || primaryEvent.lane === "background") {
            return {
                ...this.withSessionId(input.sessionId),
                events: [{ id: primaryEvent.id, kind: primaryEvent.kind }]
            };
        }
        const derivedPaths = filePaths.slice(0, MAX_DERIVED_FILES);
        const derivedEventPromises = derivedPaths.map((filePath) => this.record({
            taskId: input.taskId,
            kind: "file.changed",
            title: filePath.split("/").at(-1) ?? filePath,
            body: filePath,
            filePaths: [filePath],
            metadata: {
                sourceKind: input.kind,
                sourceEventId: primaryEvent.id
            },
            ...this.withSessionId(input.sessionId)
        }));
        const derivedEvents = await Promise.all(derivedEventPromises);
        return {
            ...this.withSessionId(input.sessionId),
            events: [primaryEvent, ...derivedEvents].map((event) => ({
                id: event.id,
                kind: event.kind
            }))
        };
    }
}
