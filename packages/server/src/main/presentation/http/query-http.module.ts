import { Module } from "@nestjs/common";
import {
    AdminController,
    BookmarkController,
    EvaluationController,
    RuleCommandController,
    SearchController,
    TurnPartitionController,
} from "~adapters/http/query/index.js";
import { ApplicationModule } from "../application/application.module.js";

@Module({
    imports: [ApplicationModule],
    controllers: [
        AdminController,
        BookmarkController,
        EvaluationController,
        RuleCommandController,
        SearchController,
        TurnPartitionController,
    ],
})
export class QueryHttpModule {}
