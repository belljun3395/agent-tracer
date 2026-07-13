import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { JOB_STATUS, LOCAL_JOB_LEASE_TTL_MS } from "@monitor/kernel";
import { AI_JOB_REPOSITORY, type AiJobRepositoryPort } from "~tracer-api/domain/job/port/ai.job.repository.port.js";

const RUNNING_ONLY = [JOB_STATUS.running] as const;

export interface RenewJobLeaseInput {
    readonly userId: string;
    readonly id: string;
    readonly leaseOwner: string;
    readonly now: Date;
}

export interface RenewJobLeaseResult {
    /** false면 실행기가 실행을 중단해야 하는 취소 신호다. */
    readonly leaseHeld: boolean;
    readonly canceled: boolean;
}

/** 로컬 실행기의 리스를 연장하고 계속 실행해도 되는지 알린다. */
@Injectable()
export class RenewJobLeaseUseCase {
    constructor(
        @Inject(AI_JOB_REPOSITORY)
        private readonly jobs: AiJobRepositoryPort,
    ) {}

    async execute(input: RenewJobLeaseInput): Promise<RenewJobLeaseResult> {
        const job = await this.jobs.findById(input.id);
        // 남의 잡은 존재 여부도 드러내지 않는다.
        if (job === null || !job.isOwnedBy(input.userId)) throw new NotFoundException("Job not found");

        if (job.status === JOB_STATUS.canceled) return { leaseHeld: false, canceled: true };
        if (!job.isLeaseHeldBy(input.leaseOwner) || job.isTerminal()) {
            return { leaseHeld: false, canceled: false };
        }

        job.renewLease(input.leaseOwner, input.now, LOCAL_JOB_LEASE_TTL_MS);
        const won = await this.jobs.commitTransition(job, RUNNING_ONLY);
        if (!won) {
            const current = await this.jobs.findById(input.id);
            return { leaseHeld: false, canceled: current?.status === JOB_STATUS.canceled };
        }
        return { leaseHeld: true, canceled: false };
    }
}
