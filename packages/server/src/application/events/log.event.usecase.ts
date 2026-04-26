import {
    createEventRecordDraft,
    KIND,
    normalizeFilePaths,
} from "~domain/monitoring/index.js";
import {
    deriveFileChangeEventInputs,
    shouldApplyLoggedEventTaskStatusEffect,
} from "~domain/monitoring/index.js";
import type { TimelineEvent } from "~domain/monitoring/index.js";
import type { MonitoringTask } from "~domain/monitoring/index.js";
import type {
    NotificationPublisherPort,
    TaskReadPort,
    TaskWritePort,
    TimelineEventWritePort,
} from "../ports/index.js";
import { projectTimelineEvent } from "./timeline-event.projection.js";
import type { LogEventUseCaseIn, LogEventUseCaseOut } from "./dto/log.event.usecase.dto.js";
import { TaskNotFoundError } from "../tasks/common/task.errors.js";
import type { RuleEnforcementPostProcessor } from "~application/verification/services/rule.enforcement.post.processor.js";
import type { TurnLifecyclePostProcessor } from "~application/verification/services/turn.lifecycle.post.processor.js";

type EventRecordingInput = Parameters<typeof createEventRecordDraft>[0];

export class LogEventUseCase {
    constructor(
        private readonly taskRepo: TaskReadPort & TaskWritePort,
        private readonly eventRepo: TimelineEventWritePort,
        private readonly notifier: NotificationPublisherPort,
        private readonly ruleEnforcement?: RuleEnforcementPostProcessor,
        private readonly turnLifecycle?: TurnLifecyclePostProcessor,
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
        for (const eventInput of deriveFileChangeEventInputs({
            sourceEvent: primaryEvent,
            filePaths,
            ...(input.sessionId ? { sessionId: input.sessionId } : {}),
        })) {
            derivedEvents.push(await this.#insertEvent(eventInput));
        }

        const allEvents = [primaryEvent, ...derivedEvents].map((e) => ({ id: e.id, kind: e.kind }));
        const sessionId = input.sessionId;

        const desiredStatus = input.taskEffects?.taskStatus as MonitoringTask["status"] | undefined;
        if (
            desiredStatus !== undefined &&
            shouldApplyLoggedEventTaskStatusEffect({ currentStatus: task.status, desiredStatus })
        ) {
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
        const record = createEventRecordDraft(input);
        const event = await this.eventRepo.insert({ id: globalThis.crypto.randomUUID(), ...record });
        this.notifier.publish({ type: "event.logged", payload: projectTimelineEvent(event) });

        // Verification sequencing:
        // - user.message opens the turn before per-event matching.
        // - assistant.response must be matched while the turn is still open,
        //   then closes/evaluates the turn.
        // - all other events are matched against the current open turn.
        if (this.ruleEnforcement && this.turnLifecycle) {
            try {
                if (event.kind === KIND.userMessage) {
                    await this.turnLifecycle.processLoggedEvent(event);
                    await this.ruleEnforcement.processLoggedEvent(event);
                } else if (event.kind === KIND.assistantResponse) {
                    await this.ruleEnforcement.processLoggedEvent(event);
                    await this.turnLifecycle.processLoggedEvent(event);
                } else {
                    await this.ruleEnforcement.processLoggedEvent(event);
                    await this.turnLifecycle.processLoggedEvent(event);
                }
            } catch (err) {
                console.error("[verification] post-processor failed for event", event.id, err);
            }
        }
        return event;
    }
}
