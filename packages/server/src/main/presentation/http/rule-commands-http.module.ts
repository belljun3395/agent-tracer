import { Module } from "@nestjs/common";
import {
    GlobalRuleCommandWriteController,
    TaskRuleCommandWriteController,
} from "~adapters/http/ingest/index.js";
import {
    GlobalRuleCommandController,
    TaskRuleCommandController,
} from "~adapters/http/query/index.js";
import { RuleCommandsApplicationModule } from "../application/rule-commands-application.module.js";

@Module({
    imports: [RuleCommandsApplicationModule],
    controllers: [
        GlobalRuleCommandController,
        GlobalRuleCommandWriteController,
        TaskRuleCommandController,
        TaskRuleCommandWriteController,
    ],
})
export class RuleCommandsHttpModule {}
