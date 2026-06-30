import { Module, type DynamicModule } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { SessionIngestController } from "./api/session.ingest.controller.js";
import { EndRuntimeSessionUseCase } from "./application/end.runtime.session.usecase.js";
import { EnsureRuntimeSessionUseCase } from "./application/ensure.runtime.session.usecase.js";
import { NOTIFICATION_PUBLISHER_PORT } from "./application/outbound/tokens.js";
import { SessionNotificationPublisherAdapter } from "./adapter/session.notification.publisher.adapter.js";
import { RuntimeBindingEntity } from "./domain/runtime.binding.entity.js";
import { SessionEntity } from "./domain/session.entity.js";
import { RUNTIME_BINDING_LOOKUP, SESSION_LIFECYCLE } from "./public/tokens.js";
import { RuntimeBindingRepository } from "./repository/runtime.binding.repository.js";
import { SessionRepository } from "./repository/session.repository.js";

@Module({})
export class SessionModule {
    static register(databaseModule: DynamicModule): DynamicModule {
        return {
            module: SessionModule,
            imports: [
                TypeOrmModule.forFeature([SessionEntity, RuntimeBindingEntity]),
                databaseModule,
            ],
            controllers: [SessionIngestController],
            providers: [
                SessionRepository,
                RuntimeBindingRepository,
                SessionNotificationPublisherAdapter,
                EnsureRuntimeSessionUseCase,
                EndRuntimeSessionUseCase,

                { provide: SESSION_LIFECYCLE, useExisting: SessionRepository },
                { provide: RUNTIME_BINDING_LOOKUP, useExisting: RuntimeBindingRepository },

                { provide: NOTIFICATION_PUBLISHER_PORT, useExisting: SessionNotificationPublisherAdapter },
            ],
            exports: [SESSION_LIFECYCLE, RUNTIME_BINDING_LOOKUP],
        };
    }
}
