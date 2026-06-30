import { Module, type DynamicModule } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { TurnPartitionController } from "./api/turn.partition.controller.js";
import { GetTurnPartitionUseCase } from "./application/get.turn.partition.usecase.js";
import { UpsertTurnPartitionUseCase } from "./application/upsert.turn.partition.usecase.js";
import { ResetTurnPartitionUseCase } from "./application/reset.turn.partition.usecase.js";
import { TurnPartitionEntity } from "./domain/turn.partition.entity.js";
import { TurnPartitionRepository } from "./repository/turn.partition.repository.js";

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
                GetTurnPartitionUseCase,
                UpsertTurnPartitionUseCase,
                ResetTurnPartitionUseCase,
            ],
        };
    }
}
