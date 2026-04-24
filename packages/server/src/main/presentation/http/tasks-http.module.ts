import { Module } from "@nestjs/common";
import { TaskLifecycleController } from "~adapters/http/ingest/index.js";
import { TaskQueryController } from "~adapters/http/query/index.js";
import { TasksApplicationModule } from "../application/tasks-application.module.js";

@Module({
    imports: [TasksApplicationModule],
    controllers: [
        TaskLifecycleController,
        TaskQueryController,
    ],
})
export class TasksHttpModule {}
