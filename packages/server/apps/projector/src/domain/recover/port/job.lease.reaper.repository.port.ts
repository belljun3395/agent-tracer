import type { JobStatus } from "@monitor/kernel";
import type { AiJobEntity } from "@monitor/tracer-domain";

/** 만료된 리스 회수가 사용하는 잡 저장소 포트다. */
export interface JobLeaseReaperJobRepository {
    findExpiredLeases(now: Date, limit: number): Promise<AiJobEntity[]>;
    commitTransition(job: AiJobEntity, from: readonly JobStatus[]): Promise<boolean>;
}

/** 회수 트랜잭션 안에서 리스 회수가 사용하는 저장소 경계다. */
export interface JobLeaseReaperRepositories {
    readonly jobs: JobLeaseReaperJobRepository;
}
