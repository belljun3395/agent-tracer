import { Inject, Injectable } from "@nestjs/common";
import {
    RULE_PROPOSAL_DISCARD_REASON,
    RULE_SEVERITY,
    RULE_SOURCE,
    admitReviewState,
    computeRuleSignature,
    type DiscardedRuleProposal,
    type RuleProposalDiscardReason,
    type RuleProposalPayload,
} from "@monitor/kernel";
import { parseRuleProposals } from "@monitor/kernel/rule/proposal/rule.proposal.schema.js";
import { generateUlid } from "@monitor/platform";
import { RuleEntity } from "@monitor/tracer-domain";
import { RULE_EVENT_READER, type EventReaderPort } from "~tracer-api/domain/job/port/rule-verification/event.reader.port.js";
import type { RuleRepositoryPort } from "~tracer-api/domain/job/port/rule-verification/rule.repository.port.js";
import { RULE_TURN_REPOSITORY, type TurnRepositoryPort } from "~tracer-api/domain/job/port/rule-verification/turn.repository.port.js";
import { RuleBackfillService } from "~tracer-api/domain/job/application/rule.backfill.service.js";

interface VerifiedCitations {
    readonly turnIds: ReadonlySet<string>;
    readonly eventIds: ReadonlySet<string>;
}

interface PrepareRuleGenerationResultInput {
    readonly rules: Pick<RuleRepositoryPort, "findSignaturesByAnchor" | "upsert">;
    readonly userId: string;
    readonly sourceJobId: string;
    readonly taskId: string | null;
    readonly jobInput: Readonly<Record<string, unknown>>;
    readonly proposals: readonly unknown[];
    readonly now: Date;
}

interface PreparedRuleGenerationResult {
    readonly jobResult: Readonly<Record<string, unknown>>;
    readonly afterCommit: () => Promise<void>;
}

interface RuleCreationOutcome {
    readonly created: readonly RuleEntity[];
    readonly discarded: readonly DiscardedRuleProposal[];
}

function readAnchorEventId(jobInput: Readonly<Record<string, unknown>>): string | null {
    const value = jobInput["anchorEventId"];
    return typeof value === "string" && value.trim().length > 0 ? value : null;
}

/** 규칙 생성 잡의 제안을 수용하고 커밋 뒤 소급 판정을 연결한다. */
@Injectable()
export class RuleGenerationResultService {
    constructor(
        private readonly backfill: RuleBackfillService,
        @Inject(RULE_EVENT_READER)
        private readonly events: EventReaderPort,
        @Inject(RULE_TURN_REPOSITORY)
        private readonly turns: TurnRepositoryPort,
    ) {}

    async prepare(input: PrepareRuleGenerationResultInput): Promise<PreparedRuleGenerationResult> {
        const { accepted, rejected } = parseRuleProposals(input.proposals);
        const outcome = await this.createRules(input, accepted);
        const jobResult = {
            rulesCreated: outcome.created.length,
            ...(rejected.length > 0 ? { proposalsRejected: rejected } : {}),
            ...(outcome.discarded.length > 0 ? { proposalsDiscarded: outcome.discarded } : {}),
        };

        return {
            jobResult,
            afterCommit: async () => {
                for (const rule of outcome.created) {
                    await this.backfill.backfill(rule, rule.taskId, input.now);
                }
            },
        };
    }

    /** 데몬은 로컬 버퍼로 인용을 검증했으나 서버는 전체 원장을 소유하므로 저장 전에 다시 대조해 실재하지 않는 식별자를 걸러낸다. */
    private async createRules(
        input: PrepareRuleGenerationResultInput,
        proposals: readonly RuleProposalPayload[],
    ): Promise<RuleCreationOutcome> {
        const taskId = input.taskId;
        const anchorEventId = readAnchorEventId(input.jobInput);
        const blocker = this.blockingReason(taskId, anchorEventId);
        if (blocker !== null) {
            return {
                created: [],
                discarded: proposals.map((proposal) => ({ name: proposal.name, reason: blocker })),
            };
        }

        const verified = await this.verifyCitations(input.userId, taskId!, proposals);
        const seen = new Set(await input.rules.findSignaturesByAnchor(input.userId, anchorEventId!));
        const created: RuleEntity[] = [];
        const discarded: DiscardedRuleProposal[] = [];
        for (const proposal of proposals) {
            const signature = computeRuleSignature(proposal.expect);
            if (seen.has(signature)) {
                discarded.push({ name: proposal.name, reason: RULE_PROPOSAL_DISCARD_REASON.duplicate });
                continue;
            }

            const rule = new RuleEntity();
            rule.id = generateUlid(input.now.getTime());
            rule.userId = input.userId;
            rule.name = proposal.name;
            rule.expectation = proposal.expect;
            rule.taskId = taskId!;
            rule.anchorEventId = anchorEventId!;
            rule.citedTurnIds = proposal.citedTurnIds.filter((id) => verified.turnIds.has(id));
            rule.citedEventIds = proposal.citedEventIds.filter((id) => verified.eventIds.has(id));
            rule.source = RULE_SOURCE.agent;
            rule.severity = proposal.severity ?? RULE_SEVERITY.info;
            rule.reviewState = admitReviewState(rule.source, rule.severity);
            rule.rationale = proposal.rationale ?? null;
            rule.signature = signature;
            rule.sourceJobId = input.sourceJobId;
            rule.createdAt = input.now;
            rule.deletedAt = null;
            await input.rules.upsert(rule);
            seen.add(signature);
            created.push(rule);
        }
        return { created, discarded };
    }

    /** 인용된 이벤트는 이 사용자·태스크의 것이어야 하고 인용된 턴은 이 태스크의 것이어야 원장이 뒷받침하는 근거다. */
    private async verifyCitations(
        userId: string,
        taskId: string,
        proposals: readonly RuleProposalPayload[],
    ): Promise<VerifiedCitations> {
        const citedEventIds = [...new Set(proposals.flatMap((proposal) => proposal.citedEventIds))];
        const events = citedEventIds.length > 0 ? await this.events.findByIds(citedEventIds) : [];
        const eventIds = new Set(
            events.filter((event) => event.userId === userId && event.taskId === taskId).map((event) => event.id),
        );
        const turns = await this.turns.findByTask(taskId);
        const turnIds = new Set(turns.map((turn) => turn.id));
        return { turnIds, eventIds };
    }

    private blockingReason(taskId: string | null, anchorEventId: string | null): RuleProposalDiscardReason | null {
        if (taskId === null) return RULE_PROPOSAL_DISCARD_REASON.noTask;
        if (anchorEventId === null) return RULE_PROPOSAL_DISCARD_REASON.noAnchor;
        return null;
    }
}
