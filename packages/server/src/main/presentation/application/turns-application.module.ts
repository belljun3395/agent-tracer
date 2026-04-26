import { Module, type DynamicModule } from "@nestjs/common";
import { TURNS_APPLICATION_EXPORTS, TURNS_APPLICATION_PROVIDERS } from "./turns.providers.js";

@Module({
    providers: TURNS_APPLICATION_PROVIDERS,
    exports: [...TURNS_APPLICATION_EXPORTS],
})
export class TurnsApplicationModule {
    static register(databaseModule: DynamicModule): DynamicModule {
        return {
            module: TurnsApplicationModule,
            imports: [databaseModule],
        };
    }
}
