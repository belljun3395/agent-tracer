import { JOB_KIND, JOB_STATUS } from "@monitor/kernel";
import type { IClock } from "@monitor/platform";
import { buildJobUsage } from "~ai-agent-worker/support/llm/job.attempt.js";
import { recipeScanSummary } from "~ai-agent-worker/domain/recipe/model/recipe.candidate.model.js";
import type { RecipeScanFinalizeInput } from "~ai-agent-worker/domain/recipe/model/recipe.job.model.js";
import type { RecipeNotificationPort } from "~ai-agent-worker/domain/recipe/port/recipe.notification.port.js";
import type { RecipeRepositoryPort } from "~ai-agent-worker/domain/recipe/port/recipe.repository.port.js";

/** 후보 저장과 잡 종결을 한 커밋으로 묶고 결과를 알린다. */
export class FinalizeRecipeScanUsecase {
    constructor(
        private readonly repository: RecipeRepositoryPort,
        private readonly notification: RecipeNotificationPort,
        private readonly clock: IClock,
    ) {}

    async execute(input: RecipeScanFinalizeInput): Promise<void> {
        const now = this.clock.now();
        const settled = await this.repository.commitScan({
            jobId: input.jobId,
            userId: input.userId,
            sourceTaskId: input.sourceTaskId,
            language: input.language,
            recipes: input.output.recipes,
            steps: input.output.jobSteps,
            attempt: input.output.attempt,
            usage: buildJobUsage(input.output),
            now,
        });
        if (settled === null) return;

        await this.notification.jobUpdated(input.userId, {
            jobId: input.jobId,
            kind: JOB_KIND.recipeScan,
            status: JOB_STATUS.completed,
            summary: recipeScanSummary(settled.candidatesCreated),
            durationMs: input.output.durationMs,
        });
    }
}
