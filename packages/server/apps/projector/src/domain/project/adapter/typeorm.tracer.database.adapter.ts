import { Inject, Injectable } from "@nestjs/common";
import type { DataSource, EntityManager } from "typeorm";
import { KIND } from "@monitor/kernel";
import { assertSchemaUpToDate } from "@monitor/platform";
import {
    ASYNC_ACTION_STATUS,
    EventEntity,
    EventRepository,
    RecipeApplicationEntity,
    RecipeApplicationRepository,
    RuleEntity,
    RuleRepository,
    SessionEntity,
    SessionRepository,
    TaskEntity,
    TaskRepository,
    TurnEntity,
    TurnRepository,
    VerdictEntity,
    VerdictRepository,
} from "@monitor/tracer-domain";
import { TRACER_MIGRATIONS } from "@monitor/tracer-domain/migrations/registry.js";
import { TRACER_DATA_SOURCE } from "~projector/config/tracer.datasource.token.js";
import type { LedgerProjectionRepositories } from "~projector/domain/project/port/projection.repositories.port.js";
import type { TracerDatabase } from "~projector/domain/project/port/tracer.database.port.js";

const TRACER_MIGRATION_NAMES = TRACER_MIGRATIONS.map((migration) => migration.name);

/** 공유 tracer DataSource로 원장 배치 트랜잭션과 이 슬라이스가 쓰는 읽기 모델 저장소를 연다. */
@Injectable()
export class TypeOrmTracerDatabaseAdapter implements TracerDatabase {
    constructor(@Inject(TRACER_DATA_SOURCE) private readonly dataSource: DataSource) {}

    async initialize(): Promise<void> {
        if (!this.dataSource.isInitialized) await this.dataSource.initialize();
        // 마이그레이션은 배포 선행 스텝이 소유하고 부트는 스키마 버전만 검사한다.
        await assertSchemaUpToDate(this.dataSource, TRACER_MIGRATION_NAMES);
    }

    async destroy(): Promise<void> {
        if (this.dataSource.isInitialized) await this.dataSource.destroy();
    }

    async ping(): Promise<void> {
        await this.dataSource.query("SELECT 1");
    }

    withTransaction<T>(work: (repositories: LedgerProjectionRepositories) => Promise<T>): Promise<T> {
        return this.dataSource.transaction((manager) => work(this.build(manager)));
    }

    private build(manager: EntityManager): LedgerProjectionRepositories {
        const events = manager.getRepository(EventEntity);
        return {
            tasks: new TaskRepository(manager.getRepository(TaskEntity)),
            sessions: new SessionRepository(manager.getRepository(SessionEntity)),
            events: new EventRepository(events),
            turns: new TurnRepository(manager.getRepository(TurnEntity)),
            rules: new RuleRepository(manager.getRepository(RuleEntity)),
            verdicts: new VerdictRepository(manager.getRepository(VerdictEntity)),
            recipeApplications: new RecipeApplicationRepository(manager.getRepository(RecipeApplicationEntity)),
            findEventById: (id) => events.findOne({ where: { id } }),
            findRunningAsyncAction: (taskId, asyncTaskId) =>
                events
                    .createQueryBuilder("e")
                    .where("e.task_id = :taskId", { taskId })
                    .andWhere("e.kind = :kind", { kind: KIND.actionLogged })
                    .andWhere("e.metadata ->> 'asyncTaskId' = :asyncTaskId", { asyncTaskId })
                    .andWhere("e.metadata ->> 'asyncStatus' = :status", { status: ASYNC_ACTION_STATUS.running })
                    .orderBy("e.seq", "DESC")
                    .getOne(),
        };
    }
}
