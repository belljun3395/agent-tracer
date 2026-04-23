import {
    KIND,
    isBackgroundLane,
    isExplorationLane,
    type MonitoringTask,
    type TimelineEvent,
} from "~domain/index.js";
import { mapTimelineEventToRecord } from "~application/views/index.js";
import type { ITaskRepository, IEventRepository, INotificationPublisher } from "../ports/index.js";
import type { BaseIngestEventInput, LogEventResult } from "./log.event.usecase.dto.js";
import { buildEventRecord, normalizeFilePaths } from "./event.recording.ops.js";

const MAX_DERIVED_FILES = 15;

export class LogEventUseCase {
    constructor(
        private readonly taskRepo: ITaskRepository,
        private readonly eventRepo: IEventRepository,
        private readonly notifier: INotificationPublisher,
    ) {}

    async execute(input: BaseIngestEventInput): Promise<LogEventResult> {
        const task = await this.taskRepo.findById(input.taskId);
        if (!task) throw new Error(`Task not found: ${input.taskId}`);

        const filePaths = normalizeFilePaths(input.filePaths);
        const primaryEvent = await this.#insertEvent({ ...input, filePaths: filePaths.length > 0 ? filePaths : undefined });

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

    async #insertEvent(input: BaseIngestEventInput): Promise<TimelineEvent> {
        const record = buildEventRecord(input);
        const event = await this.eventRepo.insert({ id: globalThis.crypto.randomUUID(), ...record });
        this.notifier.publish({ type: "event.logged", payload: mapTimelineEventToRecord(event) });
        return event;
    }
}
