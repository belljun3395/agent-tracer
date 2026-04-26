import { Module, type DynamicModule } from "@nestjs/common";
import { TaskCommandController } from "~adapters/http/command/controllers/task/task.command.controller.js";
import { TaskIngestController } from "~adapters/http/ingest/controllers/task/task.ingest.controller.js";
import { TaskQueryController } from "~adapters/http/query/controllers/task/task.query.controller.js";

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
