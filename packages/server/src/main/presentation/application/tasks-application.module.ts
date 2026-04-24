import { Module } from "@nestjs/common";
import { TASK_APPLICATION_EXPORTS, TASK_APPLICATION_PROVIDERS } from "./tasks.providers.js";

@Module({
    providers: TASK_APPLICATION_PROVIDERS,
    exports: [...TASK_APPLICATION_EXPORTS],
})
export class TasksApplicationModule {}
