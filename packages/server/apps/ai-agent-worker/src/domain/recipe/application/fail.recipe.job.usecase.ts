import { JOB_KIND, JOB_STATUS } from "@monitor/kernel";
import type { IClock } from "@monitor/platform";
import type { FailRecipeJobInput } from "~ai-agent-worker/domain/recipe/model/recipe.job.model.js";
import type { RecipeNotificationPort } from "~ai-agent-worker/domain/recipe/port/recipe.notification.port.js";
import type { RecipeRepositoryPort } from "~ai-agent-worker/domain/recipe/port/recipe.repository.port.js";

const ERROR_LIMIT = 1000;
const SUMMARY_LIMIT = 240;

/** 워크플로가 재시도를 모두 소진한 뒤에만 불러 잡을 실패로 종결한다. */
export class FailRecipeJobUsecase {
    constructor(
        private readonly repository: RecipeRepositoryPort,
        private readonly notification: RecipeNotificationPort,
        private readonly clock: IClock,
    ) {}

    async execute(input: FailRecipeJobInput): Promise<void> {
        const failed = await this.repository.failJob(
            input.jobId,
            truncate(input.message, ERROR_LIMIT),
            this.clock.now(),
        );
        if (failed === null) return;

        await this.notification.jobUpdated(failed.userId, {
            jobId: failed.id,
            kind: JOB_KIND.recipeScan,
            status: JOB_STATUS.failed,
            error: truncate(input.message, SUMMARY_LIMIT),
        });
    }
}

function truncate(value: string, limit: number): string {
    return value.length <= limit ? value : `${value.slice(0, limit)}...`;
}
