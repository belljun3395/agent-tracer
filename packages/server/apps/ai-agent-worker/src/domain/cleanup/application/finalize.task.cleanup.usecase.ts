import { JOB_KIND, JOB_STATUS } from "@monitor/kernel";
import type { IClock } from "@monitor/platform";
import { buildJobUsage } from "~ai-agent-worker/support/llm/job.attempt.js";
import type { TaskCleanupFinalizeInput } from "~ai-agent-worker/domain/cleanup/model/cleanup.job.model.js";
import { taskCleanupSummary } from "~ai-agent-worker/domain/cleanup/model/cleanup.suggestion.model.js";
import type { CleanupNotificationPort } from "~ai-agent-worker/domain/cleanup/port/cleanup.notification.port.js";
import type { CleanupRepositoryPort } from "~ai-agent-worker/domain/cleanup/port/cleanup.repository.port.js";

/** 제안 저장과 잡 종결을 한 커밋으로 묶고 결과를 알린다. */
export class FinalizeTaskCleanupUsecase {
    constructor(
        private readonly repository: CleanupRepositoryPort,
        private readonly notification: CleanupNotificationPort,
        private readonly clock: IClock,
    ) {}

    async execute(input: TaskCleanupFinalizeInput): Promise<void> {
        const now = this.clock.now();
        const output = input.output;
        const settled = await this.repository.commitCleanup({
            jobId: input.jobId,
            userId: input.userId,
            tasksScanned: input.tasksScanned,
            suggestions: output?.suggestions ?? [],
            steps: output?.jobSteps ?? [],
            attempt: output?.attempt ?? 1,
            usage: output !== null ? buildJobUsage(output) : {},
            now,
        });
        if (settled === null) return;

        await this.notification.jobUpdated(input.userId, {
            jobId: input.jobId,
            kind: JOB_KIND.taskCleanup,
            status: JOB_STATUS.completed,
            summary: taskCleanupSummary(settled.suggestionsCreated, input.tasksScanned),
            durationMs: output?.durationMs ?? 0,
        });
    }
}
