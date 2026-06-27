import { Module, type DynamicModule } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { EventCommandController } from "./api/event.command.controller.js";
import { EventIngestController } from "./api/event.ingest.controller.js";
import { PreprocessingHintsController } from "./api/preprocessing.hints.controller.js";
import { SearchQueryController } from "./api/search.query.controller.js";
import { TypedEventIngestController } from "./api/typed.event.ingest.controller.js";
import { CrossCheckDedupeCache } from "./application/cross.check.dedupe.cache.js";
import { CommandRepetitionDetector } from "./application/detectors/command.repetition.detector.js";
import { ContextPressureDetector } from "./application/detectors/context.pressure.detector.js";
import { DuplicateQuestionDetector } from "./application/detectors/duplicate.question.detector.js";
import { GetPreprocessingHintsUseCase } from "./application/get.preprocessing.hints.usecase.js";
import { IngestEventsUseCase } from "./application/ingest.events.usecase.js";
import { LogEventUseCase } from "./application/log.event.usecase.js";
import { SearchEventsUseCase } from "./application/search.events.usecase.js";
import { UpdateEventUseCase } from "./application/update.event.usecase.js";
import {
    EVENT_PERSISTENCE_PORT,
    EVENT_SEARCH_INDEX_PORT,
    NOTIFICATION_PUBLISHER_PORT,
    TASK_ACCESS_PORT,
    VERIFICATION_POST_PROCESSOR_PORT,
} from "./application/outbound/tokens.js";
import { EventNotificationPublisherAdapter } from "./adapter/notification.publisher.adapter.js";
import { EventPersistenceAdapter } from "./adapter/event.persistence.adapter.js";
import { EventTaskAccessAdapter } from "./adapter/task.access.adapter.js";
import { TimelineEventProjectionPublicAdapter } from "./adapter/timeline.event.projection.public.adapter.js";
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
    TIMELINE_EVENT_PROJECTION,
    TIMELINE_EVENT_READ,
    TIMELINE_EVENT_WRITE,
} from "./public/tokens.js";
import { Client } from "@opensearch-project/opensearch";
import { AppConfigService } from "~config/app-config.service.js";
import {
    OPENSEARCH_CLIENT,
    OpenSearchEventIndex,
} from "./repository/search/opensearch.event.index.js";
import { EventAsyncRefRepository } from "./repository/event.async.ref.repository.js";
import { EventFileRepository } from "./repository/event.file.repository.js";
import { EventRelationRepository } from "./repository/event.relation.repository.js";
import { EventTagRepository } from "./repository/event.tag.repository.js";
import { EventTokenUsageRepository } from "./repository/event.token.usage.repository.js";
import { PreprocessingHintsRepository } from "./repository/preprocessing.hints.repository.js";
import { QuestionCurrentRepository } from "./repository/question.current.repository.js";
import { TimelineEventRepository } from "./repository/timeline.event.repository.js";
import { TodoCurrentRepository } from "./repository/todo.current.repository.js";
import { TimelineEventService } from "./service/timeline.event.service.js";
import { TimelineEventStorageService } from "./service/timeline.event.storage.service.js";

/**
 * 이벤트 모듈 — 타임라인 이벤트를 소유한다.
 *
 * 영속성: timeline_events_view 테이블과 파생 테이블(event_files, event_relations,
 * event_async_refs, event_tags, todos_current, questions_current,
 * event_token_usage)을 TypeORM 엔티티로 직접 기록한다.
 *
 * 공개 표면: TIMELINE_EVENT_READ / TIMELINE_EVENT_WRITE / TIMELINE_EVENT_PROJECTION.
 * 아웃바운드: EVENT_PERSISTENCE_PORT, EVENT_SEARCH_INDEX_PORT, TASK_ACCESS_PORT,
 * NOTIFICATION_PUBLISHER_PORT, VERIFICATION_POST_PROCESSOR_PORT.
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
            controllers: [EventCommandController, EventIngestController, PreprocessingHintsController, SearchQueryController, TypedEventIngestController],
            providers: [
                // OpenSearch 클라이언트
                {
                    provide: OPENSEARCH_CLIENT,
                    inject: [AppConfigService],
                    useFactory: (config: AppConfigService): Client =>
                        new Client({ node: config.opensearch.node }),
                },
                OpenSearchEventIndex,
                // Repositories
                TimelineEventRepository,
                EventFileRepository,
                EventRelationRepository,
                EventAsyncRefRepository,
                EventTagRepository,
                TodoCurrentRepository,
                QuestionCurrentRepository,
                EventTokenUsageRepository,
                PreprocessingHintsRepository,
                // Services
                TimelineEventStorageService,
                TimelineEventService,
                // Outbound adapters
                EventPersistenceAdapter,
                EventTaskAccessAdapter,
                EventNotificationPublisherAdapter,
                VerificationPostProcessorAdapter,
                // Public adapters
                TimelineEventWritePublicAdapter,
                TimelineEventProjectionPublicAdapter,
                // Use cases
                CrossCheckDedupeCache,
                LogEventUseCase,
                IngestEventsUseCase,
                SearchEventsUseCase,
                UpdateEventUseCase,
                // Preprocessing-hint detectors + orchestrator
                ContextPressureDetector,
                DuplicateQuestionDetector,
                CommandRepetitionDetector,
                GetPreprocessingHintsUseCase,
                // Public iservices
                { provide: TIMELINE_EVENT_READ, useExisting: TimelineEventService },
                { provide: TIMELINE_EVENT_WRITE, useExisting: TimelineEventWritePublicAdapter },
                { provide: TIMELINE_EVENT_PROJECTION, useExisting: TimelineEventProjectionPublicAdapter },
                // Outbound bindings
                { provide: EVENT_PERSISTENCE_PORT, useExisting: EventPersistenceAdapter },
                { provide: EVENT_SEARCH_INDEX_PORT, useExisting: OpenSearchEventIndex },
                { provide: TASK_ACCESS_PORT, useExisting: EventTaskAccessAdapter },
                { provide: NOTIFICATION_PUBLISHER_PORT, useExisting: EventNotificationPublisherAdapter },
                { provide: VERIFICATION_POST_PROCESSOR_PORT, useExisting: VerificationPostProcessorAdapter },
            ],
            exports: [
                TIMELINE_EVENT_READ,
                TIMELINE_EVENT_WRITE,
                TIMELINE_EVENT_PROJECTION,
            ],
        };
    }
}
