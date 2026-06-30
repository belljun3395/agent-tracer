import { Module, type DynamicModule } from "@nestjs/common";
import { CLOCK_PORT, ID_GENERATOR_PORT } from "@monitor/shared/kernel/clock.js";
import { SystemClockAdapter } from "@monitor/shared/kernel/system.clock.adapter.js";
import { CryptoIdGeneratorAdapter } from "@monitor/shared/kernel/crypto.id.generator.adapter.js";
import { RULE_GENERATION_DISPATCHER } from "@monitor/rules-api/rule/generation/application/outbound/rule.generation.dispatcher.port.js";
import { TITLE_SUGGESTION_DISPATCHER } from "@monitor/run-api/task/application/outbound/title.suggestion.dispatcher.port.js";
import { TemporalClientProvider } from "../temporal/temporal.client.provider.js";
import { TemporalRuleGenerationDispatcher } from "../temporal/temporal.rule.generation.dispatcher.js";
import { TemporalTitleSuggestionDispatcher } from "../temporal/temporal.title.suggestion.dispatcher.js";
import type { ServerModuleOptions } from "../server.module.options.js";
import {
    DatabaseProviders,
    NOTIFICATION_PUBLISHER_TOKEN,
} from "./database.provider.js";

@Module({})
export class DatabaseModule {
    static forRoot(options: ServerModuleOptions): DynamicModule {
        return {
            module: DatabaseModule,
            providers: [
                ...DatabaseProviders(options),
                SystemClockAdapter,
                CryptoIdGeneratorAdapter,
                { provide: CLOCK_PORT, useExisting: SystemClockAdapter },
                { provide: ID_GENERATOR_PORT, useExisting: CryptoIdGeneratorAdapter },
                TemporalClientProvider,
                TemporalRuleGenerationDispatcher,
                TemporalTitleSuggestionDispatcher,
                {
                    provide: RULE_GENERATION_DISPATCHER,
                    useExisting: TemporalRuleGenerationDispatcher,
                },
                {
                    provide: TITLE_SUGGESTION_DISPATCHER,
                    useExisting: TemporalTitleSuggestionDispatcher,
                },
            ],
            exports: [
                NOTIFICATION_PUBLISHER_TOKEN,
                CLOCK_PORT,
                ID_GENERATOR_PORT,
                RULE_GENERATION_DISPATCHER,
                TITLE_SUGGESTION_DISPATCHER,
            ],
        };
    }
}
