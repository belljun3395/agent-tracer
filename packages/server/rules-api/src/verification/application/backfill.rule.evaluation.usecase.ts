import { matchEventAgainstRule } from "@monitor/rules-api/verification/domain/event.rule.matching.policy.js";
import { RULE_SCOPE } from "@monitor/rules-api/rule/domain/const/rule.const.js";
import { NOTIFICATION_TYPE } from "@monitor/shared/contracts/notifications/notification.type.const.js";
import { Transactional } from "typeorm-transactional";
import { inferToolCall } from "@monitor/rules-api/verification/domain/tool.call.inference.policy.js";
import type { TurnVerdict } from "@monitor/rules-api/verification/domain/type/verdict.type.js";
import { evaluateTurn } from "@monitor/rules-api/verification/domain/turn.evaluation.policy.js";
import type { EvaluateTurnToolCall } from "@monitor/rules-api/verification/domain/turn.evaluation.policy.js";
import { aggregateVerdict } from "@monitor/rules-api/verification/domain/verdict.policy.js";
import type { TimelineEvent } from "@monitor/timeline-api/event/public/types/event.types.js";
import type { INotificationPublisher } from "@monitor/shared/contracts/notifications/notification.publisher.port.js";
import type { ITimelineEventAccess } from "@monitor/rules-api/verification/application/outbound/timeline.event.access.port.js";
import type {
    IRuleEnforcementRepository,
    RuleEnforcementInsert,
} from "@monitor/rules-api/verification/application/outbound/rule.enforcement.repository.port.js";
import type { ITurnQueryRepository, BackfillTurnRow as BackfillTurnPortRow } from "@monitor/rules-api/verification/application/outbound/turn.query.repository.port.js";
import type { ITurnRepository } from "@monitor/rules-api/verification/application/outbound/turn.repository.port.js";
import type { IVerdictRepository } from "@monitor/rules-api/verification/application/outbound/verdict.repository.port.js";

import type { Rule } from "@monitor/rules-api/rule/public/types/rule.types.js";
import type {
    BackfillRuleEvaluationUseCaseIn,
    BackfillRuleEvaluationUseCaseOut,
} from "./dto/backfill.rule.evaluation.usecase.dto.js";

export type BackfillTurnSource = ITurnQueryRepository;
export type BackfillTurnRow = BackfillTurnPortRow;

export interface BackfillRuleEvaluationDeps {
    readonly turnRepo: ITurnRepository;
    readonly turnSource: BackfillTurnSource;
    readonly verdictRepo: IVerdictRepository;
    readonly eventRepo: ITimelineEventAccess;
    readonly enforcementRepo: IRuleEnforcementRepository;
    readonly notifier: INotificationPublisher;
    readonly now: () => string;
    readonly newVerdictId: () => string;
}

export class BackfillRuleEvaluationUseCase {
    constructor(private readonly deps: BackfillRuleEvaluationDeps) {}

    @Transactional()
    async execute(input: BackfillRuleEvaluationUseCaseIn): Promise<BackfillRuleEvaluationUseCaseOut> {
        const {
            turnRepo,
            turnSource,
            verdictRepo,
            eventRepo,
            enforcementRepo,
            notifier,
            now,
            newVerdictId,
        } = this.deps;
        const { rule } = input;
        const turns = await listTurnsForRuleScope(turnSource, rule);
        let evaluated = 0;
        let created = 0;

        for (const turn of turns) {
            const events = await collectTurnEvents(turnRepo, eventRepo, turn.id);
            const insertedEnforcements = await enforcementRepo.insertMany(
                buildEnforcementInserts(events, rule, now()),
            );
            for (const row of insertedEnforcements) {
                const event = events.find((candidate) => candidate.id === row.eventId);
                if (!event) continue;
                notifier.publish({
                    type: NOTIFICATION_TYPE.ruleEnforcementAdded,
                    payload: {
                        eventId: row.eventId,
                        ruleId: row.ruleId,
                        matchKind: row.matchKind,
                        taskId: event.taskId,
                        ...(event.sessionId ? { sessionId: event.sessionId } : {}),
                    },
                });
            }

            if (turn.status === "open") {
                evaluated += 1;
                continue;
            }

            const existing = await verdictRepo.findByTurnId(turn.id);
            const hadExistingVerdict = existing.some((v) => v.ruleId === rule.id);

            const { verdicts } = evaluateTurn({
                turnId: turn.id,
                assistantText: turn.assistantText,
                ...(turn.userMessageText ? { userMessageText: turn.userMessageText } : {}),
                toolCalls: inferTurnToolCalls(events),
                rules: [rule],
                now: now(),
                newVerdictId,
            });

            const persisted = await this.persistVerdicts(verdicts, now());
            if (!hadExistingVerdict) {
                created += persisted.length;
            }

            if (!hadExistingVerdict) {
                const stored = await turnRepo.findById(turn.id);
                const evaluatedCount = (stored?.rulesEvaluatedCount ?? 0) + 1;
                await turnRepo.updateRulesEvaluatedCount(turn.id, evaluatedCount);
            }

            if (persisted.length > 0) {
                const allVerdicts = await verdictRepo.findByTurnId(turn.id);
                const aggregate = aggregateVerdict(allVerdicts.map((v) => v.status));
                await turnRepo.updateAggregateVerdict(turn.id, aggregate);
                const updated = await turnRepo.findById(turn.id);
                if (updated) {
                    notifier.publish({
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

            evaluated += 1;
        }

        return {
            turnsConsidered: turns.length,
            turnsEvaluated: evaluated,
            verdictsCreated: created,
        };
    }

    private async persistVerdicts(
        verdicts: ReadonlyArray<TurnVerdict>,
        evaluatedAt: string,
    ): Promise<TurnVerdict[]> {
        const persisted: TurnVerdict[] = [];
        for (const verdict of verdicts) {
            const saved = await this.deps.verdictRepo.insert({
                id: verdict.id,
                turnId: verdict.turnId,
                ruleId: verdict.ruleId,
                status: verdict.status,
                detail: {
                    ...(verdict.detail.matchedPhrase !== undefined
                        ? { matchedPhrase: verdict.detail.matchedPhrase }
                        : {}),
                    ...(verdict.detail.expectedPattern !== undefined
                        ? { expectedPattern: verdict.detail.expectedPattern }
                        : {}),
                    actualToolCalls: [...verdict.detail.actualToolCalls],
                    ...(verdict.detail.matchedToolCalls !== undefined
                        ? { matchedToolCalls: [...verdict.detail.matchedToolCalls] }
                        : {}),
                },
                evaluatedAt,
            });
            persisted.push(saved);
        }
        return persisted;
    }
}

function listTurnsForRuleScope(
    turnSource: BackfillTurnSource,
    rule: Rule,
): Promise<ReadonlyArray<BackfillTurnRow>> {
    return rule.scope === RULE_SCOPE.task && rule.taskId
        ? turnSource.listTurnsForTaskBackfill(rule.taskId)
        : turnSource.listAllTurnsForBackfill();
}

async function collectTurnEvents(
    turnRepo: ITurnRepository,
    eventRepo: ITimelineEventAccess,
    turnId: string,
): Promise<readonly TimelineEvent[]> {
    const eventIds = await turnRepo.findEventsForTurn(turnId);
    const events: TimelineEvent[] = [];
    for (const eventId of eventIds) {
        const event = await eventRepo.findById(eventId);
        if (event) events.push(event);
    }
    return events;
}

function inferTurnToolCalls(events: readonly TimelineEvent[]): readonly EvaluateTurnToolCall[] {
    const toolCalls: EvaluateTurnToolCall[] = [];
    for (const event of events) {
        const toolCall = inferToolCall(event);
        if (toolCall) toolCalls.push(toolCall);
    }
    return toolCalls;
}

function buildEnforcementInserts(
    events: readonly TimelineEvent[],
    rule: Rule,
    decidedAt: string,
): readonly RuleEnforcementInsert[] {
    const inserts: RuleEnforcementInsert[] = [];
    for (const event of events) {
        for (const matchKind of matchEventAgainstRule(event, rule)) {
            inserts.push({ eventId: event.id, ruleId: rule.id, matchKind, decidedAt });
        }
    }
    return inserts;
}
