import { Inject, Injectable } from "@nestjs/common";
import { NOTIFICATION_PUBLISHER_TOKEN } from "@monitor/shared/contracts/notifications/notification.publisher.port.js";
import { NOTIFICATION_TYPE } from "@monitor/shared/contracts/notifications/notification.type.const.js";
import type { INotificationPublisher } from "@monitor/shared/contracts/notifications/notification.publisher.port.js";
import { RuleJobRepository } from "../../repository/job/rule.job.repository.js";
import { RegisterSuggestionUseCase } from "../rule/register.suggestion.usecase.js";

export interface RuleProposalInput {
    readonly name: string;
    readonly trigger?: { readonly phrases: readonly string[] };
    readonly triggerOn?: "user" | "assistant";
    readonly expect: {
        readonly action?: "command" | "file-read" | "file-write" | "web";
        readonly commandMatches?: readonly string[];
        readonly pattern?: string;
    };
    readonly rationale: string;
}

export interface ReportRuleProposalsInput {
    readonly jobId: string;
    readonly rules: readonly RuleProposalInput[];
    readonly modelUsed: string;
    readonly durationMs: number;
    readonly costUsd?: number | null;
    readonly numTurns?: number | null;
    readonly usage?: {
        readonly inputTokens: number;
        readonly outputTokens: number;
        readonly cacheReadTokens: number;
        readonly cacheCreationTokens: number;
    } | null;
}

@Injectable()
export class ReportRuleProposalsUseCase {
    constructor(
        private readonly jobs: RuleJobRepository,
        private readonly registerSuggestion: RegisterSuggestionUseCase,
        @Inject(NOTIFICATION_PUBLISHER_TOKEN) private readonly notifier: INotificationPublisher,
    ) {}

    async execute(input: ReportRuleProposalsInput): Promise<{ rulesCreated: number }> {
        const job = await this.jobs.findById(input.jobId);
        if (!job || !job.taskId) throw new Error(`rule job not found: ${input.jobId}`);

        let rulesCreated = 0;
        for (const proposal of input.rules) {
            const result = await this.registerSuggestion.execute({
                name: proposal.name,
                ...(proposal.trigger ? { trigger: proposal.trigger } : {}),
                ...(proposal.triggerOn ? { triggerOn: proposal.triggerOn } : {}),
                expect: {
                    ...(proposal.expect.action !== undefined ? { action: proposal.expect.action } : {}),
                    ...(proposal.expect.commandMatches !== undefined ? { commandMatches: [...proposal.expect.commandMatches] } : {}),
                    ...(proposal.expect.pattern !== undefined ? { pattern: proposal.expect.pattern } : {}),
                },
                scope: "task",
                taskId: job.taskId,
                severity: "info",
                rationale: proposal.rationale,
            });
            if (result.created) rulesCreated++;
        }

        await this.jobs.markCompleted({
            id: input.jobId,
            rulesCreated,
            modelUsed: input.modelUsed,
            durationMs: input.durationMs,
            costUsd: input.costUsd ?? null,
            numTurns: input.numTurns ?? null,
            usage: input.usage ?? null,
            completedAt: new Date().toISOString(),
        });

        this.notifier.publish({
            type: NOTIFICATION_TYPE.sdkJobUpdated,
            payload: {
                kind: "rule-generation",
                status: "succeeded",
                jobId: input.jobId,
                taskId: job.taskId,
                summary: rulesCreated === 0 ? "No new rules suggested" : `${rulesCreated} ${rulesCreated === 1 ? "rule" : "rules"} suggested`,
                durationMs: input.durationMs,
            },
        });

        return { rulesCreated };
    }
}
