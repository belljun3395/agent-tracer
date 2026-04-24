import { Module, type DynamicModule } from "@nestjs/common";
import { TaskLifecycleController } from "~adapters/http/ingest/index.js";
import { TaskQueryController } from "~adapters/http/query/index.js";

@Module({
    controllers: [
        TaskLifecycleController,
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
