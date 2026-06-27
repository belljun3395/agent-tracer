import { Inject, Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { GovernanceJobRepository } from "@monitor/governance-api/job/governance.job.repository.js";
import type { GovernanceJobEntity } from "@monitor/governance-api/job/governance.job.entity.js";
import { RULE_PERSISTENCE_PORT } from "@monitor/governance-api/rule/application/outbound/tokens.js";
import type { IRulePersistence } from "@monitor/governance-api/rule/application/outbound/rule.persistence.port.js";
import { VERIFICATION_BACKFILL } from "@monitor/governance-api/verification/public/tokens.js";
import type { IVerificationBackfill } from "@monitor/governance-api/verification/public/iservice/verification.backfill.iservice.js";

export class RuleNotFoundForBackfillError extends Error {
    constructor(public readonly ruleId: string) {
        super(`Rule not found: ${ruleId}`);
        this.name = "RuleNotFoundForBackfillError";
    }
}

/**
 * `rule_backfill` 거버넌스 잡을 소유한다: enqueue(재평가 HTTP 엔드포인트가 호출)와
 * execute(잡을 원자적으로 claim 한 뒤 백필 실행). 한 룰에 대해 닫힌 턴들을
 * 변경된 룰로 다시 평가한다.
 */
@Injectable()
export class RuleBackfillService {
    private readonly logger = new Logger(RuleBackfillService.name);

    constructor(
        private readonly jobs: GovernanceJobRepository,
        @Inject(RULE_PERSISTENCE_PORT) private readonly rules: IRulePersistence,
        @Inject(VERIFICATION_BACKFILL) private readonly backfill: IVerificationBackfill,
    ) {}

    /**
     * `ruleId`에 대한 백필을 큐에 넣는다. 룰 존재를 먼저 검증해 호출자가 조용히
     * 실패하는 잡 대신 404를 받게 한다. 멱등: 이미 pending/processing 백필이 있으면
     * 중복 스윕을 쌓지 않고 그것을 반환한다.
     */
    async enqueue(ruleId: string): Promise<GovernanceJobEntity> {
        const rule = await this.rules.findById(ruleId);
        if (!rule) throw new RuleNotFoundForBackfillError(ruleId);

        const existing = await this.jobs.findActiveForRule("rule_backfill", ruleId);
        if (existing) return existing;

        return this.jobs.insert({
            id: randomUUID(),
            jobType: "rule_backfill",
            ruleId,
            createdAt: new Date().toISOString(),
        });
    }

    /** API 요청 안에서 재평가를 동기 실행하고 완료된 잡을 반환한다. */
    async run(ruleId: string): Promise<GovernanceJobEntity> {
        const job = await this.enqueue(ruleId);
        await this.execute(job);
        const completed = await this.jobs.findById(job.id);
        return completed ?? job;
    }

    /**
     * 잡 하나를 실행하고 항상 completed/failed 로 전이시킨다.
     */
    async execute(job: GovernanceJobEntity): Promise<void> {
        const ruleId = job.ruleId;
        if (!ruleId) {
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
                // enqueue와 처리 사이에 룰이 삭제됨 — 백필할 대상이 없다.
                // 실패가 아니라 no-op 성공으로 처리한다.
                await this.jobs.markCompleted({
                    id: job.id,
                    verdictsCreated: 0,
                    modelUsed: "n/a",
                    durationMs: Date.now() - startedMs,
                    completedAt: new Date().toISOString(),
                });
                return;
            }

            const result = await this.backfill.backfill(rule);

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
