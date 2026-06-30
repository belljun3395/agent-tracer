import { Module, type DynamicModule } from "@nestjs/common";
import type { INotificationPublisher } from "@monitor/shared/contracts/notifications/notification.publisher.port.js";
import { CLOCK_PORT, ID_GENERATOR_PORT } from "@monitor/shared/kernel/clock.js";
import { SystemClockAdapter } from "@monitor/shared/kernel/system.clock.adapter.js";
import { CryptoIdGeneratorAdapter } from "@monitor/shared/kernel/crypto.id.generator.adapter.js";
import { RULE_GENERATION_DISPATCHER } from "@monitor/rules-api/rule/generation/application/outbound/rule.generation.dispatcher.port.js";
import { TemporalRuleGenerationDispatcher } from "~adapters/temporal/temporal.rule.generation.dispatcher.js";
import {
    DatabaseProviders,
    NOTIFICATION_PUBLISHER_TOKEN,
} from "./database.provider.js";

export interface DatabaseModuleOptions {
    readonly notifier?: INotificationPublisher;
}

@Module({})
export class DatabaseModule {
    static forRoot(options: DatabaseModuleOptions): DynamicModule {
        return {
            module: DatabaseModule,
            providers: [
                ...DatabaseProviders(options),
                SystemClockAdapter,
                CryptoIdGeneratorAdapter,
                { provide: CLOCK_PORT, useExisting: SystemClockAdapter },
                { provide: ID_GENERATOR_PORT, useExisting: CryptoIdGeneratorAdapter },
                TemporalRuleGenerationDispatcher,
                {
                    provide: RULE_GENERATION_DISPATCHER,
                    useExisting: TemporalRuleGenerationDispatcher,
                },
            ],
            exports: [
                NOTIFICATION_PUBLISHER_TOKEN,
                CLOCK_PORT,
                ID_GENERATOR_PORT,
                RULE_GENERATION_DISPATCHER,
            ],
        };
    }
}
