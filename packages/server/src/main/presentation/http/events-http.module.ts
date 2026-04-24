import { Module, type DynamicModule } from "@nestjs/common";
import {
    EventController,
    IngestController,
    TypedIngestController,
} from "~adapters/http/ingest/index.js";
import { SearchController } from "~adapters/http/query/index.js";

@Module({
    controllers: [
        EventController,
        IngestController,
        SearchController,
        TypedIngestController,
    ],
})
export class EventsHttpModule {
    static register(
        eventsApplicationModule: DynamicModule,
        ruleCommandsApplicationModule: DynamicModule,
    ): DynamicModule {
        return {
            module: EventsHttpModule,
            imports: [
                eventsApplicationModule,
                ruleCommandsApplicationModule,
            ],
        };
    }
}
