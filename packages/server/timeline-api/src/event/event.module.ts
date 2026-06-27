import { Module, type DynamicModule } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { EventController } from "./api/event.controller.js";
import { PreprocessingHintsController } from "./api/preprocessing.hints.controller.js";
import { TypedEventIngestController } from "./api/typed.event.ingest.controller.js";
import { CrossCheckDedupeCache } from "./common/cross.check.dedupe.cache.js";
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
                TimelineEventService,

                EventPersistenceAdapter,
                EventNotificationPublisherAdapter,

                TimelineEventWritePublicAdapter,
                TimelineEventProjectionPublicAdapter,

                CrossCheckDedupeCache,
                LogEventUseCase,
                IngestEventsUseCase,
                SearchEventsUseCase,
                UpdateEventUseCase,

                ContextPressureDetector,
                DuplicateQuestionDetector,
                CommandRepetitionDetector,
                GetPreprocessingHintsUseCase,

                { provide: TIMELINE_EVENT_READ, useExisting: TimelineEventService },
                { provide: TIMELINE_EVENT_WRITE, useExisting: TimelineEventWritePublicAdapter },
                { provide: TIMELINE_EVENT_PROJECTION, useExisting: TimelineEventProjectionPublicAdapter },

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
