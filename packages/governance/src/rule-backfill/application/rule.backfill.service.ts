import { Inject, Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { GovernanceJobRepository } from "@monitor/governance/job/governance.job.repository.js";
import type { GovernanceJobEntity } from "@monitor/governance/job/governance.job.entity.js";
import { RULE_PERSISTENCE_PORT } from "@monitor/governance/rule/application/outbound/tokens.js";
import type { IRulePersistence } from "@monitor/governance/rule/application/outbound/rule.persistence.port.js";
import { VERIFICATION_BACKFILL } from "@monitor/governance/verification/public/tokens.js";
import type { IVerificationBackfill } from "@monitor/governance/verification/public/iservice/verification.backfill.iservice.js";

export class RuleNotFoundForBackfillError extends Error {
    constructor(public readonly ruleId: string) {
        super(`Rule not found: ${ruleId}`);
        this.name = "RuleNotFoundForBackfillError";
    }
}

/**
 * Owns the `rule_backfill` governance job: enqueue (called by the HTTP
 * re-evaluate endpoint) and execute (called by {@link RuleBackfillWorker}
 * after an atomic claim).
 *
 * Re-evaluation used to run the heavy backfill inline inside the request's
 * `@Transactional()`. That held the single SQLite write connection for the
 * whole sweep and — when fired without `await` — let a detached transaction
 * commit out from under the serializer's savepoints. Routing it through this
 * outbox makes the request return immediately while the worker runs the
 * backfill later as its OWN top-level transaction.
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
     * Queue a backfill for `ruleId`. Validates the rule exists up front so the
     * caller gets a 404 instead of a silently failing job. Idempotent: if a
     * backfill for this rule is already pending/processing, returns it instead
     * of piling on a duplicate sweep.
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
                // Rule was deleted between enqueue and processing — nothing to
                // backfill. Treat as a no-op success rather than a failure.
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
