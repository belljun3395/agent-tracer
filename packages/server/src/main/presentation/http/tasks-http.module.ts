import { Module, type DynamicModule } from "@nestjs/common";
import { TaskCommandController } from "~adapters/http/command/index.js";
import { TaskIngestController } from "~adapters/http/ingest/index.js";
import { TaskQueryController } from "~adapters/http/query/index.js";

@Module({
    controllers: [
        TaskCommandController,
        TaskIngestController,
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
