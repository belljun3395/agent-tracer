import { JOB_KIND, JOB_STATUS } from "@monitor/kernel";
import type { IClock } from "@monitor/platform";
import { buildJobUsage } from "~ai-agent-worker/support/llm/job.attempt.js";
import type { TitleSuggestionFinalizeInput } from "~ai-agent-worker/domain/title/model/title.job.model.js";
import { titleSuggestionSummary } from "~ai-agent-worker/domain/title/model/title.suggestion.model.js";
import type { TitleNotificationPort } from "~ai-agent-worker/domain/title/port/title.notification.port.js";
import type { TitleRepositoryPort } from "~ai-agent-worker/domain/title/port/title.repository.port.js";

/** 제안 기록과 잡 종결을 한 커밋으로 묶고 결과를 알린다. */
export class FinalizeTitleSuggestionUsecase {
    constructor(
        private readonly repository: TitleRepositoryPort,
        private readonly notification: TitleNotificationPort,
        private readonly clock: IClock,
    ) {}

    async execute(input: TitleSuggestionFinalizeInput): Promise<void> {
        const now = this.clock.now();
        const settled = await this.repository.commitSuggestions({
            jobId: input.jobId,
            userId: input.userId,
            suggestions: input.output.suggestions,
            steps: input.output.jobSteps,
            attempt: input.output.attempt,
            usage: buildJobUsage(input.output),
            now,
        });
        if (settled === null) return;

        await this.notification.jobUpdated(input.userId, {
            jobId: input.jobId,
            kind: JOB_KIND.titleSuggestion,
            status: JOB_STATUS.completed,
            summary: titleSuggestionSummary(settled.suggestionsCreated),
            durationMs: input.output.durationMs,
        });
    }
}
