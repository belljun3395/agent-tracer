import { Module, type DynamicModule } from "@nestjs/common";
import { CLOCK_PORT, ID_GENERATOR_PORT } from "@monitor/shared/kernel/clock.js";
import { SystemClockAdapter } from "@monitor/shared/kernel/system.clock.adapter.js";
import { CryptoIdGeneratorAdapter } from "@monitor/shared/kernel/crypto.id.generator.adapter.js";
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
            ],
            exports: [
                NOTIFICATION_PUBLISHER_TOKEN,
                CLOCK_PORT,
                ID_GENERATOR_PORT,
            ],
        };
    }
}
