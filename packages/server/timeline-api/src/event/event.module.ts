import { Module, type DynamicModule } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { EventController } from "./api/event.controller.js";
import { PreprocessingHintsController } from "./api/preprocessing.hints.controller.js";
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
} from "./application/outbound/tokens.js";
import { EventNotificationPublisherAdapter } from "./adapter/notification.publisher.adapter.js";
import { EventPersistenceAdapter } from "./adapter/event.persistence.adapter.js";
import { TimelineEventProjectionPublicAdapter } from "./adapter/timeline.event.projection.public.adapter.js";
import { TimelineEventWritePublicAdapter } from "./adapter/timeline.event.write.public.adapter.js";
import { TimelineEventEntity } from "./domain/timeline.event.entity.js";
import {
    TIMELINE_EVENT_PROJECTION,
    TIMELINE_EVENT_READ,
    TIMELINE_EVENT_WRITE,
} from "./public/tokens.js";
import { PgEventSearch } from "./repository/search/pg.event.search.js";
import { PreprocessingHintsRepository } from "./repository/preprocessing.hints.repository.js";
import { TimelineEventRepository } from "./repository/timeline.event.repository.js";
import { TimelineEventService } from "./service/timeline.event.service.js";
import { TimelineEventStorageService } from "./service/timeline.event.storage.service.js";

/**
 * 이벤트 모듈 — 타임라인 이벤트를 소유한다.
 *
 * 영속성: timeline_events 테이블과 파생 테이블(event_files, event_relations,
 * event_async_refs, event_tags, todos, questions,
 * event_token_usage)을 TypeORM 엔티티로 직접 기록한다.
 *
 * 공개 표면: TIMELINE_EVENT_READ / TIMELINE_EVENT_WRITE / TIMELINE_EVENT_PROJECTION.
 * 아웃바운드: EVENT_PERSISTENCE_PORT, EVENT_SEARCH_INDEX_PORT, NOTIFICATION_PUBLISHER_PORT.
 * task-status 효과와 verification은 timeline이 event.recorded 발행 후 work/rules가 구독.
 */
@Module({})
export class EventModule {
    static register(databaseModule: DynamicModule): DynamicModule {
        return {
            module: EventModule,
            imports: [
                TypeOrmModule.forFeature([
                    TimelineEventEntity,
                ]),
                databaseModule,
            ],
            controllers: [EventController, PreprocessingHintsController, TypedEventIngestController],
            providers: [
                // 검색: Postgres pg_trgm (별도 인덱스/dual-write 없음)
                PgEventSearch,
                // Repositories
                TimelineEventRepository,
                PreprocessingHintsRepository,
                // Services
                TimelineEventStorageService,
                TimelineEventService,
                // Outbound adapters
                EventPersistenceAdapter,
                EventNotificationPublisherAdapter,
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
                { provide: EVENT_SEARCH_INDEX_PORT, useExisting: PgEventSearch },
                { provide: NOTIFICATION_PUBLISHER_PORT, useExisting: EventNotificationPublisherAdapter },
            ],
            exports: [
                TIMELINE_EVENT_READ,
                TIMELINE_EVENT_WRITE,
                TIMELINE_EVENT_PROJECTION,
            ],
        };
    }
}
