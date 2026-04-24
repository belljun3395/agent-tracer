import { Module } from "@nestjs/common";
import { TaskLifecycleController } from "~adapters/http/ingest/index.js";
import { TaskQueryController } from "~adapters/http/query/index.js";
import { ApplicationModule } from "../application/application.module.js";

@Module({
    imports: [ApplicationModule],
    controllers: [
        TaskLifecycleController,
        TaskQueryController,
    ],
})
export class TasksHttpModule {}
