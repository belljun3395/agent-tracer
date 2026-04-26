import { Module, type DynamicModule } from "@nestjs/common";
import {
    RuleIngestController,
    StatuslineIngestController,
} from "~adapters/http/ingest/index.js";
import { RuleCommandController } from "~adapters/http/command/index.js";
import { RulesQueryController } from "~adapters/http/query/index.js";

@Module({
    controllers: [
        RuleIngestController,
        StatuslineIngestController,
        RuleCommandController,
        RulesQueryController,
    ],
})
export class VerificationHttpModule {
    static register(
        rulesApplicationModule: DynamicModule,
        verificationApplicationModule: DynamicModule,
    ): DynamicModule {
        return {
            module: VerificationHttpModule,
            imports: [rulesApplicationModule, verificationApplicationModule],
        };
    }
}
