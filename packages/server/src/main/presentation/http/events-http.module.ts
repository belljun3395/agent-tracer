import { Module } from "@nestjs/common";
import {
    EventController,
    IngestController,
    TypedIngestController,
} from "~adapters/http/ingest/index.js";
import { SearchController } from "~adapters/http/query/index.js";
import { EventsApplicationModule } from "../application/events-application.module.js";
import { RuleCommandsApplicationModule } from "../application/rule-commands-application.module.js";

@Module({
    imports: [
        EventsApplicationModule,
        RuleCommandsApplicationModule,
    ],
    controllers: [
        EventController,
        IngestController,
        SearchController,
        TypedIngestController,
    ],
})
export class EventsHttpModule {}
