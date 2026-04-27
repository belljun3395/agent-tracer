import { Global, Module, type DynamicModule } from "@nestjs/common";
import { TASK_APPLICATION_EXPORTS, TASK_APPLICATION_PROVIDERS } from "./tasks.providers.js";

/**
 * Marked @Global so that SessionModule can consume TaskLifecycleService and
 * other task-side bindings without creating a circular module import.
 * (Tasks needs SESSION_LIFECYCLE from SessionModule; session needs
 * TASK_LIFECYCLE_ACCESS_PORT — backed by TaskLifecycleService — from tasks.)
 */
@Global()
@Module({
    providers: TASK_APPLICATION_PROVIDERS,
    exports: [...TASK_APPLICATION_EXPORTS],
})
export class TasksApplicationModule {
    static register(databaseModule: DynamicModule, sessionModule: DynamicModule): DynamicModule {
        return {
            global: true,
            module: TasksApplicationModule,
            imports: [databaseModule, sessionModule],
        };
    }
}
