import { Module, type DynamicModule } from "@nestjs/common";
import {
    RULES_APPLICATION_EXPORTS,
    RULES_APPLICATION_PROVIDERS,
} from "./rules.providers.js";

@Module({
    providers: RULES_APPLICATION_PROVIDERS,
    exports: [...RULES_APPLICATION_EXPORTS],
})
export class RulesApplicationModule {
    static register(
        databaseModule: DynamicModule,
        verificationApplicationModule?: DynamicModule,
    ): DynamicModule {
        const imports: DynamicModule[] = [databaseModule];
        if (verificationApplicationModule) imports.push(verificationApplicationModule);
        return {
            module: RulesApplicationModule,
            imports,
        };
    }
}
