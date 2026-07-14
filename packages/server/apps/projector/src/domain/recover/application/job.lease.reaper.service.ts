import { Inject, Injectable } from "@nestjs/common";
import { JOB_STATUS } from "@monitor/kernel";
import { ADVISORY_LOCK_KEY } from "~projector/domain/recover/port/advisory.lock.keys.js";
import {
    ADVISORY_LOCK,
    type AdvisoryLockPort,
} from "~projector/domain/recover/port/advisory.lock.port.js";
import type { JobLeaseReaperRepositories } from "~projector/domain/recover/port/job.lease.reaper.repository.port.js";
import { logError, logInfo } from "~projector/support/log.js";

const REAP_BATCH = 100;
const RUNNING_ONLY = [JOB_STATUS.running] as const;

/** 리스가 만료된 실행 중 잡을 대기 상태로 되돌린다. */
@Injectable()
export class JobLeaseReaperService {
    constructor(@Inject(ADVISORY_LOCK) private readonly lock: AdvisoryLockPort<JobLeaseReaperRepositories>) {}

    async runOnce(now: Date): Promise<number> {
        try {
            const requeued = await this.lock.withAdvisoryLock(ADVISORY_LOCK_KEY.jobLeaseReaper, async (repositories) => {
                const expired = await repositories.jobs.findExpiredLeases(now, REAP_BATCH);
                let count = 0;
                for (const job of expired) {
                    job.requeue(now);
                    if (await repositories.jobs.commitTransition(job, RUNNING_ONLY)) count += 1;
                }
                return count;
            });
            if (requeued === null || requeued === 0) return 0;
            logInfo({ msg: "job-lease-reaper.requeued", count: requeued });
            return requeued;
        } catch (error) {
            logError({
                msg: "job-lease-reaper.failed",
                error: error instanceof Error ? error.message : String(error),
            });
            return 0;
        }
    }
}
