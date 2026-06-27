import { randomUUID } from "node:crypto";
import { NOTIFICATION_TYPE } from "@monitor/shared/contracts/notifications/notification.type.const.js";
import { KIND } from "@monitor/activity-api/event/public/types/event.const.js";
import type { TimelineEvent } from "@monitor/activity-api/event/public/types/event.types.js";
import { inferToolCall } from "@monitor/governance-api/verification/domain/tool.call.inference.js";
import type { INotificationPublisher } from "@monitor/shared/contracts/notifications/notification.publisher.port.js";
import type { ITimelineEventAccess } from "@monitor/governance-api/verification/application/outbound/timeline.event.access.port.js";
import type { ITurnRepository } from "@monitor/governance-api/verification/application/outbound/turn.repository.port.js";
import type { TurnEvaluationService } from "./turn.evaluation.service.js";

/**
 * Reacts to user.message / assistant.response (and session.ended for force
 * close). Opens turns on user.message, force-closes any prior open turn,
 * and runs evaluation on assistant.response.
 *
 * Per-event matching against rules (lane reclassification) lives in
 * RuleEnforcementPostProcessor, not here.
 */
export class TurnLifecyclePostProcessor {
    constructor(
        private readonly eventRepo: ITimelineEventAccess,
        private readonly turnRepo: ITurnRepository,
        private readonly turnEvaluation: TurnEvaluationService,
        private readonly notifier: INotificationPublisher,
    ) {}

    async processLoggedEvent(event: TimelineEvent): Promise<void> {
        if (!event.sessionId) return;

        if (event.kind === KIND.userMessage) {
            await this.handleUserMessage(event);
            return;
        }
        if (event.kind === KIND.assistantResponse) {
            await this.handleAssistantResponse(event);
        }
    }

    /** Force-close any open turn for this session (called on session.ended). */
    async forceCloseSession(sessionId: string, endedAt: string): Promise<void> {
        const open = await this.turnRepo.findOpenBySessionId(sessionId);
        if (!open) return;
        await this.turnRepo.forceCloseTurn(open.id, endedAt);
    }

    private async handleUserMessage(event: TimelineEvent): Promise<void> {
        const sessionId = event.sessionId!;

        // Force-close any prior open turn for this session.
        const prior = await this.turnRepo.findOpenBySessionId(sessionId);
        if (prior) {
            await this.runEvaluationForOpenTurn(prior.id, event.taskId);
            await this.turnRepo.forceCloseTurn(prior.id, event.createdAt);
        }

        const turnIndex = await this.turnRepo.countBySessionId(sessionId);
        const turnId = randomUUID();
        const askedText = event.body ?? event.title;
        await this.turnRepo.insert({
            id: turnId,
            sessionId,
            taskId: event.taskId,
            turnIndex,
            status: "open",
            startedAt: event.createdAt,
            askedText,
        });
        await this.turnRepo.linkEvents(turnId, [event.id]);
    }

    private async handleAssistantResponse(event: TimelineEvent): Promise<void> {
        const sessionId = event.sessionId!;
        const open = await this.turnRepo.findOpenBySessionId(sessionId);
        if (!open) {
            // assistant.response without a prior user.message — synthesize a
            // turn so verification still applies. (Edge case; agents can speak
            // first.)
            const turnIndex = await this.turnRepo.countBySessionId(sessionId);
            const turnId = randomUUID();
            await this.turnRepo.insert({
                id: turnId,
                sessionId,
                taskId: event.taskId,
                turnIndex,
                status: "open",
                startedAt: event.createdAt,
                askedText: null,
            });
            await this.turnRepo.linkEvents(turnId, [event.id]);
            await this.closeAndEvaluate(turnId, event);
            return;
        }
        await this.turnRepo.linkEvents(open.id, [event.id]);
        await this.closeAndEvaluate(open.id, event);
    }

    private async closeAndEvaluate(turnId: string, asstResp: TimelineEvent): Promise<void> {
        const assistantText = asstResp.body ?? asstResp.title;
        await this.runEvaluation(turnId, asstResp.taskId, assistantText);
        await this.turnRepo.closeTurn(turnId, assistantText, asstResp.createdAt);
        const updated = await this.turnRepo.findById(turnId);
        if (updated) {
            this.notifier.publish({
                type: NOTIFICATION_TYPE.verdictUpdated,
                payload: {
                    turnId: updated.id,
                    sessionId: updated.sessionId,
                    taskId: updated.taskId,
                    aggregateVerdict: updated.aggregateVerdict,
                    rulesEvaluatedCount: updated.rulesEvaluatedCount,
                },
            });
        }
    }

    /**
     * Used when force-closing an orphaned open turn. We still run evaluation
     * with whatever assistant text exists (last assistant.response in the
     * collected events, or empty).
     */
    private async runEvaluationForOpenTurn(turnId: string, taskId: string): Promise<void> {
        const eventIds = await this.turnRepo.findEventsForTurn(turnId);
        if (eventIds.length === 0) return;
        const events = await this.collectEvents(eventIds);
        const lastAssistant = [...events].reverse().find((e) => e.kind === KIND.assistantResponse);
        const assistantText = lastAssistant?.body ?? lastAssistant?.title ?? "";
        await this.runEvaluation(turnId, taskId, assistantText, events);
    }

    private async runEvaluation(
        turnId: string,
        taskId: string,
        assistantText: string,
        preloadedEvents?: ReadonlyArray<TimelineEvent>,
    ): Promise<void> {
        const eventIds = preloadedEvents
            ? preloadedEvents.map((e) => e.id)
            : await this.turnRepo.findEventsForTurn(turnId);
        const events = preloadedEvents ?? await this.collectEvents(eventIds);
        const userMessage = events.find((e) => e.kind === KIND.userMessage);
        const userMessageText = userMessage?.body ?? userMessage?.title ?? undefined;
        const toolCalls = events
            .map(inferToolCall)
            .filter((tc): tc is NonNullable<typeof tc> => tc !== null);

        await this.turnEvaluation.evaluate({
            turnId,
            taskId,
            assistantText,
            ...(userMessageText !== undefined ? { userMessageText } : {}),
            toolCalls,
        });
    }

    private async collectEvents(eventIds: readonly string[]): Promise<ReadonlyArray<TimelineEvent>> {
        const events: TimelineEvent[] = [];
        for (const id of eventIds) {
            const e = await this.eventRepo.findById(id);
            if (e) events.push(e);
        }
        return events;
    }
}
