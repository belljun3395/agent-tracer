import { Module } from "@nestjs/common";
import {
    BookmarkWriteController,
    EvaluationWriteController,
    EventController,
    IngestController,
    LifecycleController,
    RuleCommandWriteController,
    TurnPartitionWriteController,
    TypedIngestController,
} from "~adapters/http/ingest/index.js";
import { ApplicationModule } from "../application/application.module.js";

@Module({
    imports: [ApplicationModule],
    controllers: [
        BookmarkWriteController,
        EvaluationWriteController,
        EventController,
        IngestController,
        LifecycleController,
        RuleCommandWriteController,
        TurnPartitionWriteController,
        TypedIngestController,
    ],
})
export class IngestHttpModule {}
