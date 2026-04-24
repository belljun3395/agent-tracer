import { Module } from "@nestjs/common";
import { EVENTS_APPLICATION_EXPORTS, EVENTS_APPLICATION_PROVIDERS } from "./events.providers.js";

@Module({
    providers: EVENTS_APPLICATION_PROVIDERS,
    exports: [...EVENTS_APPLICATION_EXPORTS],
})
export class EventsApplicationModule {}
