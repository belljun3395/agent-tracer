import { Module } from "@nestjs/common";
import {
    GlobalRuleCommandWriteController,
    TaskRuleCommandWriteController,
} from "~adapters/http/ingest/index.js";
import {
    GlobalRuleCommandController,
    TaskRuleCommandController,
} from "~adapters/http/query/index.js";
import { ApplicationModule } from "../application/application.module.js";

@Module({
    imports: [ApplicationModule],
    controllers: [
        GlobalRuleCommandController,
        GlobalRuleCommandWriteController,
        TaskRuleCommandController,
        TaskRuleCommandWriteController,
    ],
})
export class RuleCommandsHttpModule {}
