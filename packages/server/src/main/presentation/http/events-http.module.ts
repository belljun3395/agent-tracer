import { Module, type DynamicModule } from "@nestjs/common";
import { EventCommandController } from "~adapters/http/command/controllers/event/event.command.controller.js";
import { EventIngestController } from "~adapters/http/ingest/controllers/event/event.ingest.controller.js";
import { TypedEventIngestController } from "~adapters/http/ingest/controllers/event/typed.event.ingest.controller.js";
import { SearchQueryController } from "~adapters/http/query/controllers/search/search.query.controller.js";

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
