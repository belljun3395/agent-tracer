import { Module } from "@nestjs/common";
import { TasksApplicationModule } from "./tasks-application.module.js";
import { SESSIONS_APPLICATION_EXPORTS, SESSIONS_APPLICATION_PROVIDERS } from "./sessions.providers.js";

@Module({
    imports: [TasksApplicationModule],
    providers: SESSIONS_APPLICATION_PROVIDERS,
    exports: [...SESSIONS_APPLICATION_EXPORTS],
})
export class SessionsApplicationModule {}
