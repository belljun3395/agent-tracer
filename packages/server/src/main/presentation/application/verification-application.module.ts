import { Module, type DynamicModule } from "@nestjs/common";
import {
    VERIFICATION_APPLICATION_EXPORTS,
    VERIFICATION_APPLICATION_PROVIDERS,
} from "./verification.providers.js";

@Module({
    providers: VERIFICATION_APPLICATION_PROVIDERS,
    exports: [...VERIFICATION_APPLICATION_EXPORTS],
})
export class VerificationApplicationModule {
    static register(databaseModule?: DynamicModule): DynamicModule {
        return {
            module: VerificationApplicationModule,
            ...(databaseModule ? { imports: [databaseModule] } : {}),
        };
    }
}
