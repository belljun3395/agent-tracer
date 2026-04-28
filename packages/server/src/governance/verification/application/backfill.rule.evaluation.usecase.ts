import { matchEventAgainstRule } from "~governance/verification/domain/event-rule.matching.js";
import { Transactional } from "typeorm-transactional";
import { inferToolCall } from "~governance/verification/domain/tool-call.inference.js";
import type { TurnVerdict } from "~governance/verification/domain/model/verdict.model.js";
import { evaluateTurn } from "~governance/verification/domain/turn.evaluation.js";
import type { EvaluateTurnToolCall } from "~governance/verification/domain/turn.evaluation.js";
import { aggregateVerdict } from "~governance/verification/domain/verdict.js";
import type { TimelineEvent } from "~activity/event/public/types/event.types.js";
import type { NotificationPublisherPort } from "~adapters/notifications/notification.publisher.port.js";
import type { ITimelineEventAccess } from "~governance/verification/application/outbound/timeline.event.access.port.js";
import type {
    IRuleEnforcementRepository,
    RuleEnforcementInsert,
} from "~governance/verification/application/outbound/rule.enforcement.repository.port.js";
import type { ITurnQueryRepository, BackfillTurnRow as BackfillTurnPortRow } from "~governance/verification/application/outbound/turn.query.repository.port.js";
import type { ITurnRepository } from "~governance/verification/application/outbound/turn.repository.port.js";
import type { IVerdictRepository } from "~governance/verification/application/outbound/verdict.repository.port.js";


import type {
    BackfillRuleEvaluationRuleUseCaseDto,
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
    readonly notifier: NotificationPublisherPort;
    readonly now: () => string;
    readonly newVerdictId: () => string;
}

/**
 * Re-evaluates a newly active rule against existing turns within its scope.
 *
 * For each candidate turn:
 *   1. Reclassify already-recorded events by writing rule_enforcements rows.
 *      This applies to both closed turns and currently open turns.
 *   2. For closed turns only, run the pure evaluator with rules=[rule].
 *      Existing verdicts are upserted so manual re-evaluate repairs stale
 *      verdicts after matcher changes.
 *   3. Persist any emitted verdict, bump rules_evaluated_count by 1 for
 *      newly evaluated rules, and
 *      recompute aggregate_verdict from the full verdict set.
 *
 * Step 1's idempotency lets the caller invoke backfill multiple times
 * (e.g. on every approve) without double-counting. Step 3 reads all
 * verdicts after insert, so the aggregate stays correct even if the new
 * rule is one of many already evaluated against this turn.
 */
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
                    type: "rule_enforcement.added",
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
                        type: "verdict.updated",
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
    rule: BackfillRuleEvaluationRuleUseCaseDto,
): Promise<ReadonlyArray<BackfillTurnRow>> {
    return rule.scope === "task" && rule.taskId
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
    rule: BackfillRuleEvaluationRuleUseCaseDto,
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
