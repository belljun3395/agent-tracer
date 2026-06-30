import { Module, type DynamicModule } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { EventController } from "@monitor/timeline-api/api/event/event.controller.js";
import { PreprocessingHintsController } from "@monitor/timeline-api/api/event/preprocessing.hints.controller.js";
import { TypedEventIngestController } from "@monitor/timeline-api/api/event/typed.event.ingest.controller.js";
import { CrossCheckDedupeCache } from "@monitor/timeline-api/common/event/cross.check.dedupe.cache.js";
import { CommandRepetitionDetector } from "@monitor/timeline-api/application/event/detectors/command.repetition.detector.js";
import { ContextPressureDetector } from "@monitor/timeline-api/application/event/detectors/context.pressure.detector.js";
import { DuplicateQuestionDetector } from "@monitor/timeline-api/application/event/detectors/duplicate.question.detector.js";
import { GetPreprocessingHintsUseCase } from "@monitor/timeline-api/application/event/get.preprocessing.hints.usecase.js";
import { IngestEventsUseCase } from "@monitor/timeline-api/application/event/ingest.events.usecase.js";
import { SearchEventsUseCase } from "@monitor/timeline-api/application/event/search.events.usecase.js";
import { UpdateEventUseCase } from "@monitor/timeline-api/application/event/update.event.usecase.js";
import {
    EVENT_SEARCH_INDEX_PORT,
    NOTIFICATION_PUBLISHER_PORT,
} from "@monitor/timeline-api/application/event/outbound/tokens.js";
import { EventNotificationPublisherAdapter } from "@monitor/timeline-api/adapter/event/notification.publisher.adapter.js";
import { TimelineEventProjectionPublicAdapter } from "@monitor/timeline-api/adapter/event/timeline.event.projection.public.adapter.js";
import { TimelineEventEntity } from "@monitor/timeline-api/domain/event/timeline.event.entity.js";
import {
    TIMELINE_EVENT_PROJECTION,
    TIMELINE_EVENT_READ,
    TIMELINE_EVENT_WRITE,
} from "@monitor/timeline-api/public/event/tokens.js";
import { PgEventSearch } from "@monitor/timeline-api/repository/event/search/pg.event.search.js";
import { PreprocessingHintsRepository } from "@monitor/timeline-api/repository/event/preprocessing.hints.repository.js";
import { TimelineEventRepository } from "@monitor/timeline-api/repository/event/timeline.event.repository.js";
import { EventRecordingService } from "@monitor/timeline-api/service/event/event.recording.service.js";
import { TimelineEventStorageService } from "@monitor/timeline-api/service/event/timeline.event.storage.service.js";

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

                PgEventSearch,

                TimelineEventRepository,
                PreprocessingHintsRepository,

                TimelineEventStorageService,

                EventNotificationPublisherAdapter,

                TimelineEventProjectionPublicAdapter,

                CrossCheckDedupeCache,
                EventRecordingService,
                IngestEventsUseCase,
                SearchEventsUseCase,
                UpdateEventUseCase,

                ContextPressureDetector,
                DuplicateQuestionDetector,
                CommandRepetitionDetector,
                GetPreprocessingHintsUseCase,

                { provide: TIMELINE_EVENT_READ, useExisting: TimelineEventStorageService },
                { provide: TIMELINE_EVENT_WRITE, useExisting: TimelineEventStorageService },
                { provide: TIMELINE_EVENT_PROJECTION, useExisting: TimelineEventProjectionPublicAdapter },

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
