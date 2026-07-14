import { Inject, Injectable } from "@nestjs/common";
import { ADVISORY_LOCK_KEY } from "~projector/domain/recover/port/advisory.lock.keys.js";
import {
    ADVISORY_LOCK,
    type AdvisoryLockPort,
} from "~projector/domain/recover/port/advisory.lock.port.js";
import type { AiJobStepReaperRepositories } from "~projector/domain/recover/port/ai.job.step.reaper.repository.port.js";
import { logError, logInfo } from "~projector/support/log.js";

const REAP_BATCH = 1_000;

/** 보존 기간을 넘긴 recipe-scan 잡 궤적을 주기적으로 삭제한다. */
@Injectable()
export class AiJobStepReaperService {
    constructor(@Inject(ADVISORY_LOCK) private readonly lock: AdvisoryLockPort<AiJobStepReaperRepositories>) {}

    async runOnce(now: Date, retentionMs: number): Promise<number> {
        const cutoff = new Date(now.getTime() - retentionMs);
        try {
            const deleted = await this.lock.withAdvisoryLock(ADVISORY_LOCK_KEY.aiJobStepReaper, (repositories) =>
                repositories.aiJobSteps.deleteOlderThan(cutoff, REAP_BATCH),
            );
            if (deleted === null || deleted === 0) return 0;
            logInfo({ msg: "ai-job-step-reaper.completed", count: deleted });
            return deleted;
        } catch (error) {
            logError({
                msg: "ai-job-step-reaper.error",
                error: error instanceof Error ? error.message : String(error),
            });
            return 0;
        }
    }
}
