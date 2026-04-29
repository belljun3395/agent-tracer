import { Module, type DynamicModule } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { SessionIngestController } from "./api/session.ingest.controller.js";
import { EndRuntimeSessionUseCase } from "./application/end.runtime.session.usecase.js";
import { EnsureRuntimeSessionUseCase } from "./application/ensure.runtime.session.usecase.js";
import {
    CLOCK_PORT,
    ID_GENERATOR_PORT,
    NOTIFICATION_PUBLISHER_PORT,
    TASK_ACCESS_PORT,
    TASK_LIFECYCLE_ACCESS_PORT,
} from "./application/outbound/tokens.js";
import { CryptoIdGeneratorAdapter } from "./adapter/crypto.id.generator.adapter.js";
import { SessionNotificationPublisherAdapter } from "./adapter/session.notification.publisher.adapter.js";
import { SystemClockAdapter } from "./adapter/system.clock.adapter.js";
import { TaskAccessAdapter } from "./adapter/task.access.adapter.js";
import { TaskLifecycleAccessAdapter } from "./adapter/task.lifecycle.access.adapter.js";
import { EventLogEntity } from "./domain/event.log.entity.js";
import { RuntimeBindingEntity } from "./domain/runtime.binding.entity.js";
import { SessionEntity } from "./domain/session.entity.js";
import {
    RUNTIME_BINDING_LOOKUP,
    SESSION_LIFECYCLE,
} from "./public/tokens.js";
import { RuntimeBindingRepository } from "./repository/runtime.binding.repository.js";
import { SessionRepository } from "./repository/session.repository.js";
import { RuntimeBindingService } from "./service/runtime.binding.service.js";
import { SessionLifecycleService } from "./service/session.lifecycle.service.js";
import {
    RuntimeBindingEntitySubscriber,
    SessionEntitySubscriber,
} from "./subscriber/session.event.subscriber.js";

/**
 * Session module — owns SessionEntity, RuntimeBindingEntity, EventLogEntity.
 *
 * Layer dependencies (inner → outer):
 *   domain → repository → service → application(usecase) → api(controller)
 *
 * Public surface (offered to other modules):
 *   - SESSION_LIFECYCLE       ← SessionLifecycleService
 *   - RUNTIME_BINDING_LOOKUP  ← RuntimeBindingService (narrowed by IRuntimeBindingLookup interface)
 *
 * Outbound surface (consumed from other modules; only adapters touch externals):
 *   - TASK_ACCESS_PORT             ← TaskAccessAdapter
 *   - TASK_LIFECYCLE_ACCESS_PORT   ← TaskLifecycleAccessAdapter
 *   - NOTIFICATION_PUBLISHER_PORT  ← SessionNotificationPublisherAdapter
 */
@Module({})
export class SessionModule {
    static register(databaseModule: DynamicModule): DynamicModule {
        return {
            module: SessionModule,
            global: true,
            imports: [
                TypeOrmModule.forFeature([SessionEntity, RuntimeBindingEntity, EventLogEntity]),
                databaseModule,
            ],
            controllers: [SessionIngestController],
            providers: [
                SessionRepository,
                RuntimeBindingRepository,
                SessionLifecycleService,
                RuntimeBindingService,
                TaskAccessAdapter,
                TaskLifecycleAccessAdapter,
                SessionNotificationPublisherAdapter,
                SystemClockAdapter,
                CryptoIdGeneratorAdapter,
                SessionEntitySubscriber,
                RuntimeBindingEntitySubscriber,
                EnsureRuntimeSessionUseCase,
                EndRuntimeSessionUseCase,
                // Public iservices — narrow contract is enforced by the interface; the
                // service satisfies it structurally so no separate adapter is needed.
                { provide: SESSION_LIFECYCLE, useExisting: SessionLifecycleService },
                { provide: RUNTIME_BINDING_LOOKUP, useExisting: RuntimeBindingService },
                // Outbound ports — adapter wraps the external module / transport.
                { provide: TASK_ACCESS_PORT, useExisting: TaskAccessAdapter },
                { provide: TASK_LIFECYCLE_ACCESS_PORT, useExisting: TaskLifecycleAccessAdapter },
                { provide: NOTIFICATION_PUBLISHER_PORT, useExisting: SessionNotificationPublisherAdapter },
                { provide: CLOCK_PORT, useExisting: SystemClockAdapter },
                { provide: ID_GENERATOR_PORT, useExisting: CryptoIdGeneratorAdapter },
            ],
            exports: [SESSION_LIFECYCLE, RUNTIME_BINDING_LOOKUP],
        };
    }
}
