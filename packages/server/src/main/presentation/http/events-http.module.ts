import { Module } from "@nestjs/common";
import {
    EventController,
    IngestController,
    TypedIngestController,
} from "~adapters/http/ingest/index.js";
import { SearchController } from "~adapters/http/query/index.js";
import { ApplicationModule } from "../application/application.module.js";

@Module({
    imports: [ApplicationModule],
    controllers: [
        EventController,
        IngestController,
        SearchController,
        TypedIngestController,
    ],
})
export class EventsHttpModule {}
