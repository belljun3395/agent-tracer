import { Module, type DynamicModule } from "@nestjs/common";
import {
    EventIngestController,
    TypedEventIngestController,
} from "~adapters/http/ingest/index.js";
import { EventCommandController } from "~adapters/http/command/index.js";
import { SearchQueryController } from "~adapters/http/query/index.js";

@Module({
    controllers: [
        EventIngestController,
        TypedEventIngestController,
        EventCommandController,
        SearchQueryController,
    ],
})
export class EventsHttpModule {
    static register(
        eventsApplicationModule: DynamicModule,
        rulesApplicationModule: DynamicModule,
    ): DynamicModule {
        return {
            module: EventsHttpModule,
            imports: [
                eventsApplicationModule,
                rulesApplicationModule,
            ],
        };
    }
}
