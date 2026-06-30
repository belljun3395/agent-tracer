import { Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { RuleRepository } from "../../repository/rule/rule.repository.js";
import { RuleJobRepository } from "../../repository/job/rule.job.repository.js";
import type { RuleJobEntity } from "../../domain/job/rule.job.entity.js";
import { RuleNotFoundForBackfillError } from "../../domain/backfill/rule.backfill.errors.js";
import { BackfillRuleEvaluationUseCase } from "../verification/backfill.rule.evaluation.usecase.js";

/** 단일 규칙 재평가(backfill) 작업을 enqueue하고 실행한다. */
@Injectable()
export class EnqueueRuleBackfillUseCase {
    private readonly logger = new Logger(EnqueueRuleBackfillUseCase.name);

    constructor(
        private readonly jobs: RuleJobRepository,
        private readonly rules: RuleRepository,
        private readonly backfill: BackfillRuleEvaluationUseCase,
    ) {}

    async execute(ruleId: string) {
        const enqueued = await this.enqueue(ruleId);
        await this.runJob(enqueued);
        const job = (await this.jobs.findById(enqueued.id)) ?? enqueued;
        return {
            jobId: job.id,
            status: job.status,
            ruleId: job.ruleId,
            createdAt: job.createdAt,
        };
    }

    private async enqueue(ruleId: string): Promise<RuleJobEntity> {
        const rule = await this.rules.findById(ruleId);
        if (!rule) throw new RuleNotFoundForBackfillError(ruleId);

        const existing = await this.jobs.findActiveForRule("rule_backfill", ruleId);
        // 같은 룰의 백필은 동시에 하나만 두고 기존 진행 잡을 재사용한다.
        if (existing) return existing;

        return this.jobs.insert({
            id: randomUUID(),
            jobType: "rule_backfill",
            ruleId,
            createdAt: new Date().toISOString(),
        });
    }

    private async runJob(job: RuleJobEntity): Promise<void> {
        const ruleId = job.ruleId;
        if (!ruleId) {
            // ruleId가 없는 백필 잡은 재평가 대상을 알 수 없어 실패로 닫는다.
            await this.jobs.markFailed({
                id: job.id,
                error: "rule_backfill job is missing a ruleId",
                attempts: job.attempts,
                completedAt: new Date().toISOString(),
            });
            return;
        }

        const startedMs = Date.now();
        try {
            const rule = await this.rules.findById(ruleId);
            if (!rule) {
                // enqueue 이후 룰이 삭제되면 재평가할 대상이 없으므로 빈 성공으로 닫는다.
                await this.jobs.markCompleted({
                    id: job.id,
                    verdictsCreated: 0,
                    modelUsed: "n/a",
                    durationMs: Date.now() - startedMs,
                    completedAt: new Date().toISOString(),
                });
                return;
            }

            const result = await this.backfill.execute({ rule });

            await this.jobs.markCompleted({
                id: job.id,
                verdictsCreated: result.verdictsCreated,
                modelUsed: "n/a",
                durationMs: Date.now() - startedMs,
                completedAt: new Date().toISOString(),
            });
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            this.logger.warn(`Rule backfill failed for rule=${ruleId} job=${job.id}: ${message}`);
            const attempts = await this.jobs.incrementAttempts(job.id, new Date().toISOString());
            await this.jobs.markFailed({
                id: job.id,
                error: truncate(message, 1000),
                attempts,
                completedAt: new Date().toISOString(),
            });
        }
    }
}

function truncate(s: string, n: number): string {
    return s.length <= n ? s : s.slice(0, n) + "...";
}
