import { Inject, Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { NOTIFICATION_TYPE } from "@monitor/shared/contracts/notifications/notification.type.const.js";
import { KIND } from "@monitor/timeline-api/public/types/event.const.js";
import type { TimelineEvent } from "@monitor/timeline-api/public/types/event.types.js";
import { matchEventAgainstRule } from "@monitor/rules-api/verification/domain/event.rule.matching.policy.js";
import { inferToolCall } from "@monitor/rules-api/verification/domain/tool.call.inference.policy.js";
import type { INotificationPublisher } from "@monitor/shared/contracts/notifications/notification.publisher.port.js";
import { NOTIFICATION_PUBLISHER_TOKEN } from "@monitor/shared/contracts/notifications/notification.publisher.port.js";
import type { IRuleAccess } from "@monitor/rules-api/verification/application/outbound/rule.access.port.js";
import type {
    IRuleEnforcementRepository,
    RuleEnforcementInsert,
} from "@monitor/rules-api/verification/application/outbound/rule.enforcement.repository.port.js";
import type { ITurnRepository } from "@monitor/rules-api/verification/application/outbound/turn.repository.port.js";
import type { ITimelineEventRead } from "@monitor/timeline-api/public/iservice/timeline.event.read.iservice.js";
import type {
    IVerificationPostProcessor,
    VerificationPostProcessorEvent,
} from "../public/iservice/verification.post.processor.iservice.js";
import { TurnEvaluationService } from "../service/turn.evaluation.service.js";
import { RULE_REPOSITORY_TOKEN } from "@monitor/rules-api/rule/public/tokens.js";
import { RULE_ENFORCEMENT_REPOSITORY_TOKEN, TURN_REPOSITORY_TOKEN } from "../repository/tokens.js";
import { TIMELINE_EVENT_READ } from "@monitor/timeline-api/public/tokens.js";

@Injectable()
export class VerificationPostProcessorPublicAdapter implements IVerificationPostProcessor {
    constructor(
        @Inject(RULE_REPOSITORY_TOKEN) private readonly ruleRepo: IRuleAccess,
        @Inject(TURN_REPOSITORY_TOKEN) private readonly turnRepo: ITurnRepository,
        @Inject(RULE_ENFORCEMENT_REPOSITORY_TOKEN) private readonly enforcementRepo: IRuleEnforcementRepository,
        @Inject(TIMELINE_EVENT_READ) private readonly eventRepo: ITimelineEventRead,
        private readonly turnEvaluation: TurnEvaluationService,
        @Inject(NOTIFICATION_PUBLISHER_TOKEN) private readonly notifier: INotificationPublisher,
    ) {}

    async onUserMessage(event: VerificationPostProcessorEvent): Promise<void> {
        await this.handleTurnLifecycle(event);
        await this.handleRuleEnforcement(event);
    }

    async onAssistantResponse(event: VerificationPostProcessorEvent): Promise<void> {
        await this.handleRuleEnforcement(event);
        await this.handleTurnLifecycle(event);
    }

    async onOtherEvent(event: VerificationPostProcessorEvent): Promise<void> {
        await this.handleRuleEnforcement(event);
    }

    // — Rule enforcement —

    private async handleRuleEnforcement(event: TimelineEvent): Promise<void> {
        if (!event.sessionId) return;

        const turn = await this.turnRepo.findOpenBySessionId(event.sessionId);
        if (!turn) return;

        if (event.kind !== KIND.userMessage) {
            await this.turnRepo.linkEvents(turn.id, [event.id]);
        }

        const rules = await this.ruleRepo.findActiveForTurn(turn.taskId);
        if (rules.length === 0) return;

        const inserts: RuleEnforcementInsert[] = [];
        const decidedAt = new Date().toISOString();

        for (const rule of rules) {
            const matchKinds = matchEventAgainstRule(event, rule);
            for (const matchKind of matchKinds) {
                inserts.push({ eventId: event.id, ruleId: rule.id, matchKind, decidedAt });
            }
        }

        if (inserts.length === 0) return;
        const inserted = await this.enforcementRepo.insertMany(inserts);

        for (const ins of inserted) {
            this.notifier.publish({
                type: NOTIFICATION_TYPE.ruleEnforcementAdded,
                payload: {
                    eventId: ins.eventId,
                    ruleId: ins.ruleId,
                    matchKind: ins.matchKind,
                    taskId: event.taskId,
                    sessionId: event.sessionId,
                },
            });
        }
    }

    // — Turn lifecycle —

    private async handleTurnLifecycle(event: TimelineEvent): Promise<void> {
        if (!event.sessionId) return;

        if (event.kind === KIND.userMessage) {
            await this.handleUserMessage(event);
            return;
        }
        if (event.kind === KIND.assistantResponse) {
            await this.handleAssistantResponse(event);
        }
    }

    private async handleUserMessage(event: TimelineEvent): Promise<void> {
        const sessionId = event.sessionId!;

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
