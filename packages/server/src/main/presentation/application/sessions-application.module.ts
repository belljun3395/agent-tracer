import { Module, type DynamicModule } from "@nestjs/common";
import { SESSIONS_APPLICATION_EXPORTS, SESSIONS_APPLICATION_PROVIDERS } from "./sessions.providers.js";

@Module({
    providers: SESSIONS_APPLICATION_PROVIDERS,
    exports: [...SESSIONS_APPLICATION_EXPORTS],
})
export class SessionsApplicationModule {
    static register(databaseModule: DynamicModule, tasksApplicationModule: DynamicModule): DynamicModule {
        return {
            module: SessionsApplicationModule,
            imports: [
                databaseModule,
                tasksApplicationModule,
            ],
        };
    }
}
