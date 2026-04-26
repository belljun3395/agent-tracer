import { Module, type DynamicModule } from "@nestjs/common";
import { EVENTS_APPLICATION_EXPORTS, EVENTS_APPLICATION_PROVIDERS } from "./events.providers.js";
import { VerificationApplicationModule } from "./verification-application.module.js";

@Module({
    providers: EVENTS_APPLICATION_PROVIDERS,
    exports: [...EVENTS_APPLICATION_EXPORTS],
})
export class EventsApplicationModule {
    static register(databaseModule: DynamicModule): DynamicModule {
        const verificationApplicationModule = VerificationApplicationModule.register(databaseModule);
        return {
            module: EventsApplicationModule,
            imports: [databaseModule, verificationApplicationModule],
        };
    }
}
