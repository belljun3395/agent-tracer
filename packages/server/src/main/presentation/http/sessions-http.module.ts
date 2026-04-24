import { Module, type DynamicModule } from "@nestjs/common";
import { RuntimeSessionController } from "~adapters/http/ingest/index.js";

@Module({
    controllers: [RuntimeSessionController],
})
export class SessionsHttpModule {
    static register(sessionsApplicationModule: DynamicModule): DynamicModule {
        return {
            module: SessionsHttpModule,
            imports: [sessionsApplicationModule],
        };
    }
}
