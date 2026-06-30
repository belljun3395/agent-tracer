import { Inject, Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { RuleJobRepository } from "../../job/rule.job.repository.js";
import type { RuleJobEntity } from "../../job/rule.job.entity.js";
import { RULE_PERSISTENCE_PORT } from "@monitor/rules-api/rule/application/outbound/tokens.js";
import type { IRulePersistence } from "@monitor/rules-api/rule/application/outbound/rule.persistence.port.js";
import { BackfillRuleEvaluationUseCase } from "@monitor/rules-api/verification/application/backfill.rule.evaluation.usecase.js";
import { RuleNotFoundForBackfillError } from "../domain/rule.backfill.errors.js";

@Injectable()
export class RuleBackfillService {
    private readonly logger = new Logger(RuleBackfillService.name);

    constructor(
        private readonly jobs: RuleJobRepository,
        @Inject(RULE_PERSISTENCE_PORT) private readonly rules: IRulePersistence,
        private readonly backfill: BackfillRuleEvaluationUseCase,
    ) {}

    async enqueue(ruleId: string): Promise<RuleJobEntity> {
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

    async run(ruleId: string): Promise<RuleJobEntity> {
        const job = await this.enqueue(ruleId);
        await this.execute(job);
        const completed = await this.jobs.findById(job.id);
        return completed ?? job;
    }

    async execute(job: RuleJobEntity): Promise<void> {
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
            this.logger.warn(
                `Rule backfill failed for rule=${ruleId} job=${job.id}: ${message}`,
            );
            const attempts = await this.jobs.incrementAttempts(
                job.id,
                new Date().toISOString(),
            );
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
