import { randomUUID } from "node:crypto";
import { KIND } from "~domain/index.js";
import type { TimelineEvent } from "~domain/index.js";
import {
    aggregateVerdict,
    type Rule,
    type TurnVerdict,
} from "~domain/verification/index.js";
import type { IEventRepository } from "../ports/index.js";
import type { ITurnRepository } from "../ports/repository/turn.repository.js";
import { inferToolCall } from "./infer.tool.call.js";
import type { RunTurnEvaluationUseCase } from "./run.turn.evaluation.usecase.js";

interface ResolvedTurnFrame {
    readonly turnId: string;
    readonly turnIndex: number;
}

/**
 * Reacts to logged timeline events. On `user.message` it opens a pending
 * turn; on `assistant.response` it slices the events back to the previous
 * assistant response, closes the pending turn, and runs rule evaluation.
 *
 * The "Hook" naming reflects the call site — `LogEventUseCase` invokes it
 * after every successful event insert. All side effects (turn updates,
 * rule.logged events) are confined to this class.
 */
export class TurnEvaluationHook {
    constructor(
        private readonly eventRepo: IEventRepository,
        private readonly turnRepo: ITurnRepository,
        private readonly evaluator: RunTurnEvaluationUseCase,
    ) {}

    async onEventLogged(event: TimelineEvent): Promise<void> {
        if (event.kind === KIND.userMessage) {
            await this.handleUserMessage(event);
            return;
        }
        if (event.kind === KIND.assistantResponse) {
            await this.handleAssistantResponse(event);
        }
    }

    private async handleUserMessage(event: TimelineEvent): Promise<void> {
        if (!event.sessionId) return;
        const priorTurnCount = await this.turnRepo.countBySessionId(event.sessionId);
        const turnId = randomUUID();
        await this.turnRepo.insert({
            id: turnId,
            sessionId: event.sessionId,
            index: priorTurnCount,
            startedAt: event.createdAt,
            endedAt: event.createdAt,
            assistantText: "",
        });
        await this.turnRepo.linkEvents(turnId, [event.id]);
    }

    private async handleAssistantResponse(event: TimelineEvent): Promise<void> {
        if (!event.sessionId) return;

        const turnEvents = await this.collectTurnEvents(event);
        if (turnEvents === null) return;

        const assistantText = event.body ?? "";
        const endedAt = event.createdAt;

        const frame = await this.closePendingOrCreateTurn({
            sessionId: event.sessionId,
            turnEvents,
            assistantText,
            endedAt,
        });

        const userMessageEvent = turnEvents.find((e) => e.kind === KIND.userMessage);
        const userMessageText = userMessageEvent?.body ?? userMessageEvent?.title ?? "";
        const toolCalls = turnEvents
            .map(inferToolCall)
            .filter((tc): tc is NonNullable<typeof tc> => tc !== null);

        const { verdicts, rulesEvaluated, evaluatedRules } = await this.evaluator.execute({
            turnId: frame.turnId,
            taskId: event.taskId,
            turnIndex: frame.turnIndex,
            assistantText,
            ...(userMessageText ? { userMessageText } : {}),
            toolCalls,
        });

        if (rulesEvaluated > 0) {
            await this.turnRepo.updateRulesEvaluatedCount(frame.turnId, rulesEvaluated);
        }
        if (verdicts.length > 0) {
            await this.recordVerdictAggregate(frame.turnId, verdicts);
            await this.emitRuleEvents({
                turnId: frame.turnId,
                taskId: event.taskId,
                sessionId: event.sessionId,
                endedAt,
                verdicts,
                evaluatedRules,
            });
        }
    }

    /**
     * Slice the task's events from the previous assistant response (exclusive)
     * up to and including the current one. Returns `null` if the current
     * event is not yet visible in the persistence read (race condition).
     */
    private async collectTurnEvents(event: TimelineEvent): Promise<TimelineEvent[] | null> {
        const allEvents = await this.eventRepo.findByTaskId(event.taskId);
        const currentIdx = allEvents.findIndex((e) => e.id === event.id);
        if (currentIdx === -1) return null;

        let prevAssistantIdx = -1;
        for (let i = currentIdx - 1; i >= 0; i--) {
            if (allEvents[i]!.kind === KIND.assistantResponse) {
                prevAssistantIdx = i;
                break;
            }
        }
        return allEvents.slice(prevAssistantIdx + 1, currentIdx + 1);
    }

    /**
     * Find the pending turn opened by the preceding user.message and close
     * it, or fall back to creating a fresh turn (first assistant response
     * in a session, or replay where the user.message ingest was skipped).
     */
    private async closePendingOrCreateTurn(args: {
        readonly sessionId: string;
        readonly turnEvents: readonly TimelineEvent[];
        readonly assistantText: string;
        readonly endedAt: string;
    }): Promise<ResolvedTurnFrame> {
        const eventIds = args.turnEvents.map((e) => e.id);
        const latestTurn = await this.turnRepo.findLatestBySessionId(args.sessionId);

        if (latestTurn && latestTurn.assistantText === "") {
            await this.turnRepo.updateAssistantResponse(latestTurn.id, args.assistantText, args.endedAt);
            // linkEvents is idempotent — re-linking user.message is safe
            await this.turnRepo.linkEvents(latestTurn.id, eventIds);
            return { turnId: latestTurn.id, turnIndex: latestTurn.index };
        }

        const startedAt = args.turnEvents[0]?.createdAt ?? args.endedAt;
        const priorTurnCount = await this.turnRepo.countBySessionId(args.sessionId);
        const turnId = randomUUID();
        await this.turnRepo.insert({
            id: turnId,
            sessionId: args.sessionId,
            index: priorTurnCount,
            startedAt,
            endedAt: args.endedAt,
            assistantText: args.assistantText,
        });
        await this.turnRepo.linkEvents(turnId, eventIds);
        return { turnId, turnIndex: priorTurnCount };
    }

    private async recordVerdictAggregate(
        turnId: string,
        verdicts: ReadonlyArray<TurnVerdict>,
    ): Promise<void> {
        const aggregate = aggregateVerdict(verdicts.map((v) => v.status)) ?? "unverifiable";
        await this.turnRepo.updateAggregateVerdict(turnId, aggregate);
    }

    /**
     * Emits one `rule.logged` timeline event per non-unverifiable verdict so
     * the dashboard can render rule outcomes inline with the turn's events.
     * Unverifiable verdicts are kept in the verdict store but skipped here
     * to avoid noise — they're surfaced separately on the Verdict tab.
     */
    private async emitRuleEvents(args: {
        readonly turnId: string;
        readonly taskId: string;
        readonly sessionId: string;
        readonly endedAt: string;
        readonly verdicts: ReadonlyArray<TurnVerdict>;
        readonly evaluatedRules: ReadonlyArray<Rule>;
    }): Promise<void> {
        const ruleById = new Map(args.evaluatedRules.map((r) => [r.id, r]));
        const ruleEventIds: string[] = [];

        for (const verdict of args.verdicts) {
            if (verdict.status === "unverifiable") continue;
            const rule = ruleById.get(verdict.ruleId);
            const ruleStatus = verdict.status === "verified" ? "pass" : "violation";
            const ruleEvent = await this.eventRepo.insert({
                id: randomUUID(),
                taskId: args.taskId,
                sessionId: args.sessionId,
                kind: KIND.ruleLogged,
                lane: "rule",
                title: rule?.name ?? verdict.ruleId,
                metadata: {
                    ruleId: verdict.ruleId,
                    ruleStatus,
                    ...(verdict.detail.matchedPhrase !== undefined
                        ? { matchedPhrase: verdict.detail.matchedPhrase }
                        : {}),
                    ...(verdict.detail.matchedToolCalls !== undefined
                        ? { matchedToolCalls: verdict.detail.matchedToolCalls }
                        : {}),
                },
                classification: { lane: "rule", tags: [], matches: [] },
                createdAt: args.endedAt,
            });
            ruleEventIds.push(ruleEvent.id);
        }

        if (ruleEventIds.length > 0) {
            await this.turnRepo.linkEvents(args.turnId, ruleEventIds);
        }
    }
}
