import { Module, type DynamicModule } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
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
    EVENT_SEARCH_INDEX_PORT,
    EVENT_STORE_APPENDER_PORT,
    NOTIFICATION_PUBLISHER_PORT,
    TASK_ACCESS_PORT,
    VERIFICATION_POST_PROCESSOR_PORT,
} from "./application/outbound/tokens.js";
import { DomainEventAppenderPublicAdapter } from "./adapter/domain.event.appender.public.adapter.js";
import { EventNotificationPublisherAdapter } from "./adapter/notification.publisher.adapter.js";
import { EventPersistenceAdapter } from "./adapter/event.persistence.adapter.js";
import { EventSearchIndexAdapter } from "./adapter/event.search.index.adapter.js";
import { EventStoreAppenderAdapter } from "./adapter/event.store.appender.adapter.js";
import { EventTaskAccessAdapter } from "./adapter/task.access.adapter.js";
import { TimelineEventProjectionPublicAdapter } from "./adapter/timeline.event.projection.public.adapter.js";
import { TimelineEventReadPublicAdapter } from "./adapter/timeline.event.read.public.adapter.js";
import { TimelineEventWritePublicAdapter } from "./adapter/timeline.event.write.public.adapter.js";
import { VerificationPostProcessorAdapter } from "./adapter/verification.post.processor.adapter.js";
import { EventAsyncRefEntity } from "./domain/event.async.ref.entity.js";
import { EventFileEntity } from "./domain/event.file.entity.js";
import { EventRelationEntity } from "./domain/event.relation.entity.js";
import { EventTagEntity } from "./domain/event.tag.entity.js";
import { EventTokenUsageEntity } from "./domain/event.token.usage.entity.js";
import { QuestionCurrentEntity } from "./domain/question.current.entity.js";
import { TimelineEventEntity } from "./domain/timeline.event.entity.js";
import { TodoCurrentEntity } from "./domain/todo.current.entity.js";
import {
    DOMAIN_EVENT_APPENDER,
    TIMELINE_EVENT_PROJECTION,
    TIMELINE_EVENT_READ,
    TIMELINE_EVENT_WRITE,
} from "./public/tokens.js";
import { createEmbeddingService } from "./repository/embedding/embedding.service.js";
import type { IEmbeddingService } from "./repository/embedding/embedding.service.js";
import { EMBEDDING_SERVICE_TOKEN } from "./repository/embedding/tokens.js";
import { EventAsyncRefRepository } from "./repository/event.async.ref.repository.js";
import { EventFileRepository } from "./repository/event.file.repository.js";
import { EventRelationRepository } from "./repository/event.relation.repository.js";
import { EventTagRepository } from "./repository/event.tag.repository.js";
import { EventTokenUsageRepository } from "./repository/event.token.usage.repository.js";
import { QuestionCurrentRepository } from "./repository/question.current.repository.js";
import { TimelineEventRepository } from "./repository/timeline.event.repository.js";
import { TodoCurrentRepository } from "./repository/todo.current.repository.js";
import { TimelineEventService } from "./service/timeline.event.service.js";
import { TimelineEventStorageService } from "./service/timeline.event.storage.service.js";

/**
 * Event module — owns timeline events.
 *
 * Persistence: TypeORM-backed entities for the timeline_events_view table and
 * its 6 derived tables (event_files, event_relations, event_async_refs,
 * event_tags, todos_current, questions_current, event_token_usage). Search
 * (FTS5) and the domain-event store are still served by legacy adapters and
 * accessed via dedicated outbound ports.
 *
 * Public surface:
 *   - TIMELINE_EVENT_READ        ← TimelineEventReadPublicAdapter
 *   - TIMELINE_EVENT_PROJECTION  ← TimelineEventProjectionPublicAdapter
 *
 * Outbound surface:
 *   - EVENT_PERSISTENCE_PORT          ← TypeORM TimelineEventStorageService
 *   - EVENT_SEARCH_INDEX_PORT         ← legacy FTS adapter
 *   - EVENT_STORE_APPENDER_PORT       ← legacy event-sourcing adapter
 *   - TASK_ACCESS_PORT                ← task.public ITaskAccess
 *   - NOTIFICATION_PUBLISHER_PORT     ← shared transport
 *   - VERIFICATION_POST_PROCESSOR_PORT ← legacy verification post-processors
 */
@Module({})
export class EventModule {
    static register(databaseModule: DynamicModule, governanceModule: DynamicModule): DynamicModule {
        return {
            module: EventModule,
            global: true,
            imports: [
                TypeOrmModule.forFeature([
                    TimelineEventEntity,
                    EventFileEntity,
                    EventRelationEntity,
                    EventAsyncRefEntity,
                    EventTagEntity,
                    TodoCurrentEntity,
                    QuestionCurrentEntity,
                    EventTokenUsageEntity,
                ]),
                databaseModule,
                governanceModule,
            ],
            controllers: [EventCommandController, EventIngestController, SearchQueryController, TypedEventIngestController],
            providers: [
                // Embedding service (local model)
                {
                    provide: EMBEDDING_SERVICE_TOKEN,
                    useFactory: (): IEmbeddingService | null => createEmbeddingService() ?? null,
                },
                // Repositories
                TimelineEventRepository,
                EventFileRepository,
                EventRelationRepository,
                EventAsyncRefRepository,
                EventTagRepository,
                TodoCurrentRepository,
                QuestionCurrentRepository,
                EventTokenUsageRepository,
                // Services
                TimelineEventStorageService,
                TimelineEventService,
                // Outbound adapters
                EventPersistenceAdapter,
                EventSearchIndexAdapter,
                EventStoreAppenderAdapter,
                EventTaskAccessAdapter,
                EventNotificationPublisherAdapter,
                VerificationPostProcessorAdapter,
                // Public adapters
                TimelineEventReadPublicAdapter,
                TimelineEventWritePublicAdapter,
                TimelineEventProjectionPublicAdapter,
                DomainEventAppenderPublicAdapter,
                // Use cases
                LogEventUseCase,
                IngestEventsUseCase,
                SearchEventsUseCase,
                UpdateEventUseCase,
                // Public iservices
                { provide: TIMELINE_EVENT_READ, useExisting: TimelineEventReadPublicAdapter },
                { provide: TIMELINE_EVENT_WRITE, useExisting: TimelineEventWritePublicAdapter },
                { provide: TIMELINE_EVENT_PROJECTION, useExisting: TimelineEventProjectionPublicAdapter },
                { provide: DOMAIN_EVENT_APPENDER, useExisting: DomainEventAppenderPublicAdapter },
                // Outbound bindings
                { provide: EVENT_PERSISTENCE_PORT, useExisting: EventPersistenceAdapter },
                { provide: EVENT_SEARCH_INDEX_PORT, useExisting: EventSearchIndexAdapter },
                { provide: EVENT_STORE_APPENDER_PORT, useExisting: EventStoreAppenderAdapter },
                { provide: TASK_ACCESS_PORT, useExisting: EventTaskAccessAdapter },
                { provide: NOTIFICATION_PUBLISHER_PORT, useExisting: EventNotificationPublisherAdapter },
                { provide: VERIFICATION_POST_PROCESSOR_PORT, useExisting: VerificationPostProcessorAdapter },
            ],
            exports: [
                TIMELINE_EVENT_READ,
                TIMELINE_EVENT_WRITE,
                TIMELINE_EVENT_PROJECTION,
                DOMAIN_EVENT_APPENDER,
            ],
        };
    }
}
