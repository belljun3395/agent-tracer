import { Module, type DynamicModule } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { TurnPartitionCommandController } from "./api/turn.partition.command.controller.js";
import { TurnPartitionQueryController } from "./api/turn.partition.query.controller.js";
import { GetTurnPartitionUseCase } from "./application/get.turn.partition.usecase.js";
import {
    EVENT_STORE_APPENDER_PORT,
    TASK_ACCESS_PORT,
    TIMELINE_EVENT_ACCESS_PORT,
} from "./application/outbound/tokens.js";
import { ResetTurnPartitionUseCase } from "./application/reset.turn.partition.usecase.js";
import { UpsertTurnPartitionUseCase } from "./application/upsert.turn.partition.usecase.js";
import { EventStoreAppenderAdapter } from "./adapter/event.store.appender.adapter.js";
import { TaskAccessAdapter } from "./adapter/task.access.adapter.js";
import { TimelineEventAccessAdapter } from "./adapter/timeline.event.access.adapter.js";
import { TurnPartitionEntity } from "./domain/turn.partition.entity.js";
import { TurnPartitionRepository } from "./repository/turn.partition.repository.js";

/**
 * Turn-partition module — owns the turn_partitions_current table.
 *
 * Persistence: TypeORM-backed TurnPartitionEntity + thin repository.
 *
 * Outbound surface:
 *   - TASK_ACCESS_PORT             ← task.public ITaskAccess (existence check)
 *   - TIMELINE_EVENT_ACCESS_PORT   ← event.public ITimelineEventRead (segment derivation)
 *   - EVENT_STORE_APPENDER_PORT    ← legacy SqliteEventStore.appendDomainEvent
 *
 * No public iservice — turn-partition is a leaf consumer.
 */
@Module({})
export class TurnModule {
    static register(databaseModule: DynamicModule): DynamicModule {
        return {
            module: TurnModule,
            global: true,
            imports: [
                TypeOrmModule.forFeature([TurnPartitionEntity]),
                databaseModule,
            ],
            controllers: [TurnPartitionCommandController, TurnPartitionQueryController],
            providers: [
                TurnPartitionRepository,
                // Outbound adapters
                TaskAccessAdapter,
                TimelineEventAccessAdapter,
                EventStoreAppenderAdapter,
                // Use cases
                GetTurnPartitionUseCase,
                UpsertTurnPartitionUseCase,
                ResetTurnPartitionUseCase,
                // Outbound bindings
                { provide: TASK_ACCESS_PORT, useExisting: TaskAccessAdapter },
                { provide: TIMELINE_EVENT_ACCESS_PORT, useExisting: TimelineEventAccessAdapter },
                { provide: EVENT_STORE_APPENDER_PORT, useExisting: EventStoreAppenderAdapter },
            ],
        };
    }
}
