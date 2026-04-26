import { Module, type DynamicModule } from "@nestjs/common";
import { TurnPartitionCommandController } from "~adapters/http/command/index.js";
import { TurnPartitionQueryController } from "~adapters/http/query/index.js";

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
