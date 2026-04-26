import { Module, type DynamicModule } from "@nestjs/common";
import { TurnSummaryCommandController } from "~adapters/http/command/index.js";
import { TurnsQueryController, TurnSummaryQueryController } from "~adapters/http/query/index.js";

@Module({
    controllers: [TurnSummaryCommandController, TurnsQueryController, TurnSummaryQueryController],
})
export class TurnsHttpModule {
    static register(turnsApplicationModule: DynamicModule): DynamicModule {
        return {
            module: TurnsHttpModule,
            imports: [turnsApplicationModule],
        };
    }
}
