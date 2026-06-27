import { Module, type DynamicModule } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { SessionIngestController } from "./api/session.ingest.controller.js";
import { EndRuntimeSessionUseCase } from "./application/end.runtime.session.usecase.js";
import { EnsureRuntimeSessionUseCase } from "./application/ensure.runtime.session.usecase.js";
import {
    NOTIFICATION_PUBLISHER_PORT,
    TASK_LIFECYCLE_ACCESS_PORT,
} from "./application/outbound/tokens.js";
import { SessionNotificationPublisherAdapter } from "./adapter/session.notification.publisher.adapter.js";
import { TaskLifecycleAccessAdapter } from "./adapter/task.lifecycle.access.adapter.js";
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
                SessionLifecycleService,
                RuntimeBindingService,
                TaskLifecycleAccessAdapter,
                SessionNotificationPublisherAdapter,
                EnsureRuntimeSessionUseCase,
                EndRuntimeSessionUseCase,

                { provide: SESSION_LIFECYCLE, useExisting: SessionLifecycleService },
                { provide: RUNTIME_BINDING_LOOKUP, useExisting: RuntimeBindingService },

                { provide: TASK_LIFECYCLE_ACCESS_PORT, useExisting: TaskLifecycleAccessAdapter },
                { provide: NOTIFICATION_PUBLISHER_PORT, useExisting: SessionNotificationPublisherAdapter },
            ],
            exports: [SESSION_LIFECYCLE, RUNTIME_BINDING_LOOKUP],
        };
    }
}
