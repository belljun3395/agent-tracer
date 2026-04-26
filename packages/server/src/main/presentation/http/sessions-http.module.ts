import { Module, type DynamicModule } from "@nestjs/common";
import { SessionIngestController } from "~adapters/http/ingest/index.js";

@Module({
    controllers: [SessionIngestController],
})
export class SessionsHttpModule {
    static register(sessionsApplicationModule: DynamicModule): DynamicModule {
        return {
            module: SessionsHttpModule,
            imports: [sessionsApplicationModule],
        };
    }
}
