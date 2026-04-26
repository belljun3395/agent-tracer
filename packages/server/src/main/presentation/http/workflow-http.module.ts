import { Module, type DynamicModule } from "@nestjs/common";
import {
    PlaybookCommandController,
    TaskBriefingCommandController,
    TaskEvaluationCommandController,
} from "~adapters/http/command/index.js";
import {
    EvaluationIngestController,
    WorkflowIngestController,
} from "~adapters/http/ingest/index.js";
import {
    PlaybookQueryController,
    TaskBriefingQueryController,
    TaskEvaluationQueryController,
    WorkflowQueryController,
} from "~adapters/http/query/index.js";

@Module({
    controllers: [
        EvaluationIngestController,
        PlaybookCommandController,
        PlaybookQueryController,
        TaskBriefingCommandController,
        TaskBriefingQueryController,
        TaskEvaluationCommandController,
        TaskEvaluationQueryController,
        WorkflowIngestController,
        WorkflowQueryController,
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
