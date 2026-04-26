import { Module, type DynamicModule } from "@nestjs/common";
import {
    EvaluationIngestController,
    WorkflowIngestController,
} from "~adapters/http/ingest/index.js";
import { EvaluationCommandController } from "~adapters/http/command/index.js";
import {
    TaskEvaluationController,
    WorkflowController,
} from "~adapters/http/query/index.js";

@Module({
    controllers: [
        EvaluationIngestController,
        WorkflowIngestController,
        EvaluationCommandController,
        TaskEvaluationController,
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
