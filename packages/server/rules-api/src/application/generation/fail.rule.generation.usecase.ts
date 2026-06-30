import { Inject, Injectable } from "@nestjs/common";
import { NOTIFICATION_PUBLISHER_TOKEN } from "@monitor/shared/contracts/notifications/notification.publisher.port.js";
import { NOTIFICATION_TYPE } from "@monitor/shared/contracts/notifications/notification.type.const.js";
import type { INotificationPublisher } from "@monitor/shared/contracts/notifications/notification.publisher.port.js";
import { RuleJobRepository } from "../../repository/job/rule.job.repository.js";

@Injectable()
export class FailRuleGenerationUseCase {
    constructor(
        private readonly jobs: RuleJobRepository,
        @Inject(NOTIFICATION_PUBLISHER_TOKEN) private readonly notifier: INotificationPublisher,
    ) {}

    async execute(jobId: string, error: string): Promise<void> {
        const job = await this.jobs.findById(jobId);
        await this.jobs.incrementAndMarkFailed({
            id: jobId,
            error: error.length > 1000 ? error.slice(0, 1000) + "..." : error,
            completedAt: new Date().toISOString(),
        });
        this.notifier.publish({
            type: NOTIFICATION_TYPE.sdkJobUpdated,
            payload: {
                kind: "rule-generation",
                status: "failed",
                jobId,
                ...(job?.taskId ? { taskId: job.taskId } : {}),
                error: error.length > 240 ? error.slice(0, 240) + "..." : error,
            },
        });
    }
}
