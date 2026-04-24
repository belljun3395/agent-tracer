import { Module } from "@nestjs/common";
import {
    PlaybookWriteController,
    TaskEvaluationWriteController,
} from "~adapters/http/ingest/index.js";
import {
    PlaybookController,
    TaskEvaluationController,
    WorkflowController,
} from "~adapters/http/query/index.js";
import { WorkflowApplicationModule } from "../application/workflow-application.module.js";

@Module({
    imports: [WorkflowApplicationModule],
    controllers: [
        PlaybookController,
        PlaybookWriteController,
        TaskEvaluationController,
        TaskEvaluationWriteController,
        WorkflowController,
    ],
})
export class WorkflowHttpModule {}
