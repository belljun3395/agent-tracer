import { Module, type DynamicModule } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { TurnPartitionController } from "./api/turn.partition.controller.js";
import { GetTurnPartitionUseCase } from "./application/get.turn.partition.usecase.js";
import { UpsertTurnPartitionUseCase } from "./application/upsert.turn.partition.usecase.js";
import { ResetTurnPartitionUseCase } from "./application/reset.turn.partition.usecase.js";
import {
    TASK_ACCESS_PORT,
    TIMELINE_EVENT_ACCESS_PORT,
} from "./application/outbound/tokens.js";
import { TaskAccessAdapter } from "./adapter/task.access.adapter.js";
import { TimelineEventAccessAdapter } from "./adapter/timeline.event.access.adapter.js";
import { TurnPartitionEntity } from "./domain/turn.partition.entity.js";
import { TurnPartitionRepository } from "./repository/turn.partition.repository.js";

/**
 * Turn module — task와 동일 레벨의 run 컨텍스트. turn partition 조회/갱신을 담당.
 * task(TASK_ACCESS)·timeline 발행 계약을 소비하므로 조립 루트에서 import를 연결한다.
 */
@Module({})
export class TurnModule {
    static register(databaseModule: DynamicModule): DynamicModule {
        return {
            module: TurnModule,
            imports: [
                TypeOrmModule.forFeature([TurnPartitionEntity]),
                databaseModule,
            ],
            controllers: [TurnPartitionController],
            providers: [
                TurnPartitionRepository,
                TaskAccessAdapter,
                TimelineEventAccessAdapter,
                GetTurnPartitionUseCase,
                UpsertTurnPartitionUseCase,
                ResetTurnPartitionUseCase,
                { provide: TASK_ACCESS_PORT, useExisting: TaskAccessAdapter },
                { provide: TIMELINE_EVENT_ACCESS_PORT, useExisting: TimelineEventAccessAdapter },
            ],
        };
    }
}
