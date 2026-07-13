import { Inject, Injectable } from "@nestjs/common";
import type { DataSource, EntityManager } from "typeorm";
import {
    AiJobEntity,
    AiJobRepository,
    AiJobStepEntity,
    AiJobStepRepository,
    TaskEntity,
    TaskRepository,
} from "@monitor/tracer-domain";
import { TRACER_DATA_SOURCE } from "~projector/config/tracer.datasource.token.js";
import type { AdvisoryLockPort } from "~projector/domain/recover/port/advisory.lock.port.js";
import type { AiJobStepReaperRepositories } from "~projector/domain/recover/port/ai.job.step.reaper.repository.port.js";
import type { JobLeaseReaperRepositories } from "~projector/domain/recover/port/job.lease.reaper.repository.port.js";
import type { TaskReaperRepositories } from "~projector/domain/recover/port/task.reaper.repository.port.js";

/** 회수 작업 셋이 한 어드바이저리 락 트랜잭션에서 요구하는 저장소 전량이다. */
export type RecoverLockScope = TaskReaperRepositories & AiJobStepReaperRepositories & JobLeaseReaperRepositories;

/** Postgres 어드바이저리 락으로 회수 슬라이스의 동시 실행을 하나로 좁히는 어댑터다. */
@Injectable()
export class TypeOrmAdvisoryLockAdapter implements AdvisoryLockPort<RecoverLockScope> {
    constructor(@Inject(TRACER_DATA_SOURCE) private readonly dataSource: DataSource) {}

    withAdvisoryLock<T>(lockKey: number, work: (repositories: RecoverLockScope) => Promise<T>): Promise<T | null> {
        return this.dataSource.transaction(async (manager) => {
            const rows = await manager.query<{ locked: boolean }[]>(
                "SELECT pg_try_advisory_xact_lock($1) AS locked",
                [lockKey],
            );
            if (rows[0]?.locked !== true) return null;
            return work(this.build(manager));
        });
    }

    private build(manager: EntityManager): RecoverLockScope {
        return {
            tasks: new TaskRepository(manager.getRepository(TaskEntity)),
            aiJobSteps: new AiJobStepRepository(manager.getRepository(AiJobStepEntity)),
            jobs: new AiJobRepository(manager.getRepository(AiJobEntity)),
        };
    }
}
