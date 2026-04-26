import { Module, type DynamicModule } from "@nestjs/common";
import { TurnPartitionCommandController } from "~adapters/http/command/controllers/turn/turn.partition.command.controller.js";
import { TurnPartitionQueryController } from "~adapters/http/query/controllers/turn/turn.partition.query.controller.js";

@Module({
    controllers: [
        TurnPartitionCommandController,
        TurnPartitionQueryController,
    ],
})
export class TurnPartitionsHttpModule {
    static register(turnPartitionsApplicationModule: DynamicModule): DynamicModule {
        return {
            module: TurnPartitionsHttpModule,
            imports: [turnPartitionsApplicationModule],
        };
    }
}
