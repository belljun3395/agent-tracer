import { Module, type DynamicModule } from "@nestjs/common";
import { TaskIngestController } from "~adapters/http/ingest/index.js";
import { TaskCommandController } from "~adapters/http/command/index.js";
import { TaskQueryController } from "~adapters/http/query/index.js";

@Module({
    controllers: [
        TaskIngestController,
        TaskCommandController,
        TaskQueryController,
    ],
})
export class TasksHttpModule {
    static register(tasksApplicationModule: DynamicModule): DynamicModule {
        return {
            module: TasksHttpModule,
            imports: [tasksApplicationModule],
        };
    }
}
