import { Module } from "@nestjs/common";
import { WORKFLOW_APPLICATION_EXPORTS, WORKFLOW_APPLICATION_PROVIDERS } from "./workflow.providers.js";

@Module({
    providers: WORKFLOW_APPLICATION_PROVIDERS,
    exports: [...WORKFLOW_APPLICATION_EXPORTS],
})
export class WorkflowApplicationModule {}
