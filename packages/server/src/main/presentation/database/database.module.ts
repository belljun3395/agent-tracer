import { Module, type DynamicModule } from "@nestjs/common";
import { Client } from "@opensearch-project/opensearch";
import type { INotificationPublisher } from "@monitor/shared/contracts/notifications/notification.publisher.port.js";
import { CLOCK_PORT, ID_GENERATOR_PORT } from "@monitor/shared/kernel/clock.js";
import { SystemClockAdapter } from "@monitor/shared/kernel/system.clock.adapter.js";
import { CryptoIdGeneratorAdapter } from "@monitor/shared/kernel/crypto.id.generator.adapter.js";
import { OPENSEARCH_CLIENT } from "@monitor/activity/event/repository/search/opensearch.event.index.js";
import { AppConfigService } from "~config/app-config.service.js";
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
                // OpenSearch 클라이언트는 합성 루트(인프라)에서 만들어 도메인에 토큰으로
                // 주입한다. 도메인 모듈이 설정(AppConfigService)에 직접 의존하지 않게 한다.
                {
                    provide: OPENSEARCH_CLIENT,
                    inject: [AppConfigService],
                    useFactory: (config: AppConfigService): Client =>
                        new Client({ node: config.opensearch.node }),
                },
            ],
            exports: [NOTIFICATION_PUBLISHER_TOKEN, CLOCK_PORT, ID_GENERATOR_PORT, OPENSEARCH_CLIENT],
        };
    }
}
