import { Module, type DynamicModule } from "@nestjs/common";
import { TurnPartitionWriteController } from "~adapters/http/ingest/index.js";
import { TurnPartitionController } from "~adapters/http/query/index.js";

@Module({
    controllers: [
        TurnPartitionController,
        TurnPartitionWriteController,
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
