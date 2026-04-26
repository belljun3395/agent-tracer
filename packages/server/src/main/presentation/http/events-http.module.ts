import { Module, type DynamicModule } from "@nestjs/common";
import { EventCommandController } from "~adapters/http/command/index.js";
import {
    EventIngestController,
    TypedEventIngestController,
} from "~adapters/http/ingest/index.js";
import { SearchQueryController } from "~adapters/http/query/index.js";

@Module({
    controllers: [
        EventCommandController,
        EventIngestController,
        SearchQueryController,
        TypedEventIngestController,
    ],
})
export class EventsHttpModule {
    static register(eventsApplicationModule: DynamicModule): DynamicModule {
        return {
            module: EventsHttpModule,
            imports: [eventsApplicationModule],
        };
    }
}
