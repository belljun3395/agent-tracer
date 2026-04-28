import { Module, type DynamicModule } from "@nestjs/common";
import { EventModule } from "./event/event.module.js";
import { SessionModule } from "./session/session.module.js";

/**
 * Activity bounded context — composes the session and event sub-packages
 * into a single Nest module. Both are about agent activity recording —
 * sessions provide the runtime context, events record what happened within
 * those sessions.
 *
 * Public surface continues to live under each sub-package's `public/`.
 */
@Module({})
export class ActivityModule {
    static register(databaseModule: DynamicModule, governanceModule: DynamicModule): DynamicModule {
        const sessionModule = SessionModule.register(databaseModule);
        const eventModule = EventModule.register(databaseModule, governanceModule);
        return {
            module: ActivityModule,
            imports: [sessionModule, eventModule],
        };
    }
}
