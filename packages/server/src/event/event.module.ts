import { Module, type DynamicModule } from "@nestjs/common";
import { EventCommandController } from "./api/event.command.controller.js";
import { EventIngestController } from "./api/event.ingest.controller.js";
import { SearchQueryController } from "./api/search.query.controller.js";
import { TypedEventIngestController } from "./api/typed.event.ingest.controller.js";
import { IngestEventsUseCase } from "./application/ingest.events.usecase.js";
import { LogEventUseCase } from "./application/log.event.usecase.js";
import { SearchEventsUseCase } from "./application/search.events.usecase.js";
import { UpdateEventUseCase } from "./application/update.event.usecase.js";
import {
    EVENT_PERSISTENCE_PORT,
    NOTIFICATION_PUBLISHER_PORT,
    TASK_ACCESS_PORT,
    VERIFICATION_POST_PROCESSOR_PORT,
} from "./application/outbound/tokens.js";
import { EventNotificationPublisherAdapter } from "./adapter/notification.publisher.adapter.js";
import { EventPersistenceAdapter } from "./adapter/event.persistence.adapter.js";
import { EventTaskAccessAdapter } from "./adapter/task.access.adapter.js";
import { TimelineEventProjectionPublicAdapter } from "./adapter/timeline.event.projection.public.adapter.js";
import { TimelineEventReadPublicAdapter } from "./adapter/timeline.event.read.public.adapter.js";
import { VerificationPostProcessorAdapter } from "./adapter/verification.post.processor.adapter.js";
import {
    TIMELINE_EVENT_PROJECTION,
    TIMELINE_EVENT_READ,
} from "./public/tokens.js";
import { TimelineEventService } from "./service/timeline.event.service.js";

/**
 * Event module — owns timeline events.
 *
 * NOTE: persistence layer is currently bridged to legacy SqliteEventRepository
 * via EventPersistenceAdapter. Full TypeORM migration of the multi-table
 * timeline_events_view + related tables (event_files, event_relations,
 * event_async_refs, event_tags, todos_current, questions_current,
 * event_token_usage) is a follow-up task.
 *
 * Public surface:
 *   - TIMELINE_EVENT_READ        ← TimelineEventReadPublicAdapter
 *   - TIMELINE_EVENT_PROJECTION  ← TimelineEventProjectionPublicAdapter
 *
 * Outbound surface:
 *   - EVENT_PERSISTENCE_PORT          ← legacy SqliteEventRepository wrap
 *   - TASK_ACCESS_PORT                ← task.public ITaskAccess
 *   - NOTIFICATION_PUBLISHER_PORT     ← shared transport
 *   - VERIFICATION_POST_PROCESSOR_PORT ← legacy verification post-processors
 */
@Module({})
export class EventModule {
    static register(databaseModule: DynamicModule, verificationModule: DynamicModule): DynamicModule {
        return {
            module: EventModule,
            imports: [databaseModule, verificationModule],
            controllers: [EventCommandController, EventIngestController, SearchQueryController, TypedEventIngestController],
            providers: [
                TimelineEventService,
                EventPersistenceAdapter,
                EventTaskAccessAdapter,
                EventNotificationPublisherAdapter,
                VerificationPostProcessorAdapter,
                TimelineEventReadPublicAdapter,
                TimelineEventProjectionPublicAdapter,
                LogEventUseCase,
                IngestEventsUseCase,
                SearchEventsUseCase,
                UpdateEventUseCase,
                // Public iservices
                { provide: TIMELINE_EVENT_READ, useExisting: TimelineEventReadPublicAdapter },
                { provide: TIMELINE_EVENT_PROJECTION, useExisting: TimelineEventProjectionPublicAdapter },
                // Outbound bindings
                { provide: EVENT_PERSISTENCE_PORT, useExisting: EventPersistenceAdapter },
                { provide: TASK_ACCESS_PORT, useExisting: EventTaskAccessAdapter },
                { provide: NOTIFICATION_PUBLISHER_PORT, useExisting: EventNotificationPublisherAdapter },
                { provide: VERIFICATION_POST_PROCESSOR_PORT, useExisting: VerificationPostProcessorAdapter },
            ],
            exports: [TIMELINE_EVENT_READ, TIMELINE_EVENT_PROJECTION],
        };
    }
}
