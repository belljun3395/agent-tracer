import { Module, type DynamicModule } from "@nestjs/common";
import {
    PlaybookWriteController,
    TaskEvaluationWriteController,
} from "~adapters/http/ingest/index.js";
import {
    PlaybookController,
    TaskEvaluationController,
    WorkflowController,
} from "~adapters/http/query/index.js";

@Module({
    controllers: [
        PlaybookController,
        PlaybookWriteController,
        TaskEvaluationController,
        TaskEvaluationWriteController,
        WorkflowController,
    ],
})
export class WorkflowHttpModule {
    static register(workflowApplicationModule: DynamicModule): DynamicModule {
        return {
            module: WorkflowHttpModule,
            imports: [workflowApplicationModule],
        };
    }
}
