import { Module, type DynamicModule } from "@nestjs/common";
import { TaskModule } from "./task/task.module.js";
import { TurnModule } from "./turn/turn.module.js";

/**
 * Work bounded context — composes the task and turn (turn-partition)
 * sub-packages into a single Nest module. Each sub-package keeps its own
 * vertical slice (domain/repository/service/application/adapter/api/public)
 * so it can be split out again if needed.
 *
 * Public surface continues to live under each sub-package's `public/` —
 * external modules import through `~work/task/public/...` /
 * `~work/turn/public/...` directly.
 */
@Module({})
export class WorkModule {
    static register(databaseModule: DynamicModule): DynamicModule {
        return {
            module: WorkModule,
            imports: [
                TaskModule.register(databaseModule),
                TurnModule.register(databaseModule),
            ],
        };
    }
}
