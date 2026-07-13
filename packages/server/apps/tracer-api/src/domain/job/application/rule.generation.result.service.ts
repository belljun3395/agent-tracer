import { Injectable } from "@nestjs/common";
import {
    RULE_PROPOSAL_DISCARD_REASON,
    RULE_SCOPE,
    RULE_SEVERITY,
    RULE_SOURCE,
    admitReviewState,
    computeRuleSignature,
    type DiscardedRuleProposal,
    type RuleProposalPayload,
} from "@monitor/kernel";
import { parseRuleProposals } from "@monitor/kernel/rule/proposal/rule.proposal.schema.js";
import { generateUlid } from "@monitor/platform";
import { RuleEntity } from "@monitor/tracer-domain";
import type { RuleRepositoryPort } from "~tracer-api/domain/job/port/rule-verification/rule.repository.port.js";
import { RuleBackfillService } from "~tracer-api/domain/job/application/rule.backfill.service.js";

interface PrepareRuleGenerationResultInput {
    readonly rules: Pick<RuleRepositoryPort, "findApplicableSignatures" | "upsert">;
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
    constructor(private readonly backfill: RuleBackfillService) {}

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
                    if (rule.taskId === null) continue;
                    await this.backfill.backfill(rule, rule.taskId, input.now);
                }
            },
        };
    }

    private async createRules(
        input: PrepareRuleGenerationResultInput,
        proposals: readonly RuleProposalPayload[],
    ): Promise<RuleCreationOutcome> {
        if (input.taskId === null) {
            return {
                created: [],
                discarded: proposals.map((proposal) => ({
                    name: proposal.name,
                    reason: RULE_PROPOSAL_DISCARD_REASON.noTask,
                })),
            };
        }

        const seen = new Set(await input.rules.findApplicableSignatures(input.userId, input.taskId));
        const created: RuleEntity[] = [];
        const discarded: DiscardedRuleProposal[] = [];
        for (const proposal of proposals) {
            const trigger = {
                phrases: proposal.trigger?.phrases ?? [],
                ...(proposal.triggerOn !== undefined ? { on: proposal.triggerOn } : {}),
            };
            const signature = computeRuleSignature(trigger, proposal.expect);
            if (seen.has(signature)) {
                discarded.push({ name: proposal.name, reason: RULE_PROPOSAL_DISCARD_REASON.duplicate });
                continue;
            }

            const rule = new RuleEntity();
            rule.id = generateUlid(input.now.getTime());
            rule.userId = input.userId;
            rule.name = proposal.name;
            rule.trigger = trigger;
            rule.expectation = proposal.expect;
            rule.scope = RULE_SCOPE.task;
            rule.taskId = input.taskId;
            rule.source = RULE_SOURCE.agent;
            rule.severity = proposal.severity ?? RULE_SEVERITY.info;
            rule.reviewState = admitReviewState(rule.source, rule.severity);
            rule.rationale = proposal.rationale ?? null;
            rule.signature = signature;
            rule.sourceJobId = input.sourceJobId;
            rule.anchorEventId = readAnchorEventId(input.jobInput);
            rule.createdAt = input.now;
            rule.deletedAt = null;
            await input.rules.upsert(rule);
            seen.add(signature);
            created.push(rule);
        }
        return { created, discarded };
    }
}
