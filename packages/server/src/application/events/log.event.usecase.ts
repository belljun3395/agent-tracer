import {
    KIND,
    isBackgroundLane,
    isExplorationLane,
    buildEventRecord,
    normalizeFilePaths,
    resolveSemanticView,
    resolveTimelineEventPaths,
    type MonitoringTask,
    type TimelineEvent,
} from "~domain/index.js";
import type {
    EventNotificationPayload,
    IEventRepository,
    INotificationPublisher,
    ITaskRepository,
} from "../ports/index.js";
import type { LogEventUseCaseIn, LogEventUseCaseOut } from "./dto/log.event.usecase.dto.js";
import { TaskNotFoundError } from "../tasks/common/task.errors.js";

const MAX_DERIVED_FILES = 15;
type EventRecordingInput = Parameters<typeof buildEventRecord>[0];

export class LogEventUseCase {
    constructor(
        private readonly taskRepo: ITaskRepository,
        private readonly eventRepo: IEventRepository,
        private readonly notifier: INotificationPublisher,
    ) {}

    async execute(input: LogEventUseCaseIn): Promise<LogEventUseCaseOut> {
        const task = await this.taskRepo.findById(input.taskId);
        if (!task) throw new TaskNotFoundError(input.taskId);

        const filePaths = normalizeFilePaths(input.filePaths);
        const primaryEvent = await this.#insertEvent({
            taskId: input.taskId,
            kind: input.kind,
            lane: input.lane,
            ...(input.sessionId !== undefined ? { sessionId: input.sessionId } : {}),
            ...(input.title !== undefined ? { title: input.title } : {}),
            ...(input.body !== undefined ? { body: input.body } : {}),
            ...(filePaths.length > 0 ? { filePaths } : {}),
            ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
            ...(input.parentEventId !== undefined ? { parentEventId: input.parentEventId } : {}),
            ...(input.relatedEventIds !== undefined ? { relatedEventIds: input.relatedEventIds } : {}),
            ...(input.relationType !== undefined ? { relationType: input.relationType } : {}),
            ...(input.relationLabel !== undefined ? { relationLabel: input.relationLabel } : {}),
            ...(input.relationExplanation !== undefined ? { relationExplanation: input.relationExplanation } : {}),
            ...(input.createdAt !== undefined ? { createdAt: input.createdAt } : {}),
        });

        const derivedEvents: TimelineEvent[] = [];
        if (!isExplorationLane(primaryEvent.lane) && !isBackgroundLane(primaryEvent.lane)) {
            const derivedPaths = filePaths.slice(0, MAX_DERIVED_FILES);
            for (const filePath of derivedPaths) {
                derivedEvents.push(await this.#insertEvent({
                    taskId: input.taskId,
                    kind: KIND.fileChanged,
                    lane: "implementation",
                    title: filePath.split("/").at(-1) ?? filePath,
                    body: filePath,
                    filePaths: [filePath],
                    metadata: { sourceKind: input.kind, sourceEventId: primaryEvent.id },
                    ...(input.sessionId ? { sessionId: input.sessionId } : {}),
                }));
            }
        }

        const allEvents = [primaryEvent, ...derivedEvents].map((e) => ({ id: e.id, kind: e.kind }));
        const sessionId = input.sessionId;

        const desiredStatus = input.taskEffects?.taskStatus as MonitoringTask["status"] | undefined;
        if (desiredStatus && desiredStatus !== task.status && task.status !== "completed") {
            const updatedAt = new Date().toISOString();
            await this.taskRepo.updateStatus(task.id, desiredStatus, updatedAt);
            const updatedTask = await this.taskRepo.findById(task.id);
            if (updatedTask) {
                this.notifier.publish({ type: "task.updated", payload: updatedTask });
                return { task: updatedTask, ...(sessionId ? { sessionId } : {}), events: allEvents };
            }
        }

        return { task, ...(sessionId ? { sessionId } : {}), events: allEvents };
    }

    async #insertEvent(input: EventRecordingInput): Promise<TimelineEvent> {
        const record = buildEventRecord(input);
        const event = await this.eventRepo.insert({ id: globalThis.crypto.randomUUID(), ...record });
        this.notifier.publish({ type: "event.logged", payload: toEventNotificationPayload(event) });
        return event;
    }
}

function toEventNotificationPayload(event: TimelineEvent): EventNotificationPayload {
    const semantic = resolveSemanticView(event);
    const paths = resolveTimelineEventPaths(event);

    return {
        id: event.id,
        taskId: event.taskId,
        ...(event.sessionId !== undefined ? { sessionId: event.sessionId } : {}),
        kind: event.kind,
        lane: event.lane,
        title: event.title,
        ...(event.body !== undefined ? { body: event.body } : {}),
        metadata: event.metadata,
        classification: event.classification,
        createdAt: event.createdAt,
        ...(semantic ? {
            semantic: {
                subtypeKey: semantic.subtypeKey,
                subtypeLabel: semantic.subtypeLabel,
                ...(semantic.subtypeGroup !== undefined ? { subtypeGroup: semantic.subtypeGroup } : {}),
                ...(semantic.entityType !== undefined ? { entityType: semantic.entityType } : {}),
                ...(semantic.entityName !== undefined ? { entityName: semantic.entityName } : {}),
            },
        } : {}),
        paths: {
            ...(paths.primaryPath !== undefined ? { primaryPath: paths.primaryPath } : {}),
            filePaths: paths.filePaths,
            mentionedPaths: paths.mentionedPaths,
        },
    };
}
