import { Module, type DynamicModule } from "@nestjs/common";
import type { KafkaConsumer, KafkaProducer } from "@monitor/platform";
import { ApplyLedgerBatchUseCase } from "~projector/domain/project/application/apply.ledger.batch.usecase.js";
import { ArrivalProjection } from "~projector/domain/project/application/arrival.projection.js";
import { RecipeProjection } from "~projector/domain/project/application/recipe.projection.js";
import { RuleEvaluationProjection } from "~projector/domain/project/application/rule.evaluation.projection.js";
import { RunProjection } from "~projector/domain/project/application/run.projection.js";
import { RunSessionProjection } from "~projector/domain/project/application/run.session.projection.js";
import { RunTaskProjection } from "~projector/domain/project/application/run.task.projection.js";
import { TimelineProjection } from "~projector/domain/project/application/timeline.projection.js";
import { DbConsumer } from "~projector/domain/project/inbound/db.consumer.js";
import { NOTIFICATION_PUBLISHER as PROJECT_NOTIFICATION_PUBLISHER } from "~projector/domain/project/port/notification.publisher.port.js";
import { TRACER_DATABASE, type TracerDatabase } from "~projector/domain/project/port/tracer.database.port.js";
import { NotifyUseCase } from "~projector/domain/notify/application/notify.usecase.js";
import { KafkaNotificationPublisher } from "~projector/domain/notify/adapter/kafka.notification.publisher.js";
import { NOTIFICATION_PUBLISHER as NOTIFY_NOTIFICATION_PUBLISHER } from "~projector/domain/notify/port/notification.publisher.port.js";
import { AiJobStepReaperService } from "~projector/domain/recover/application/ai.job.step.reaper.service.js";
import { JobLeaseReaperService } from "~projector/domain/recover/application/job.lease.reaper.service.js";
import { TaskReaperService } from "~projector/domain/recover/application/task.reaper.service.js";
import { ADVISORY_LOCK as RECOVER_ADVISORY_LOCK, type AdvisoryLockPort as RecoverAdvisoryLockPort } from "~projector/domain/recover/port/advisory.lock.port.js";
import { NOTIFICATION_PUBLISHER as RECOVER_NOTIFICATION_PUBLISHER } from "~projector/domain/recover/port/notification.publisher.port.js";
import type { RecoverLockScope } from "~projector/domain/recover/adapter/typeorm.advisory.lock.adapter.js";
import { IndexSearchUseCase } from "~projector/domain/index/application/index.search.usecase.js";
import { SearchEventsReaperService } from "~projector/domain/index/application/search.events.reaper.service.js";
import { SearchOutboxDrainService } from "~projector/domain/index/application/search.outbox.drain.service.js";
import { SearchConsumer } from "~projector/domain/index/inbound/search.consumer.js";
import { ADVISORY_LOCK as INDEX_ADVISORY_LOCK, type AdvisoryLockPort as IndexAdvisoryLockPort } from "~projector/domain/index/port/advisory.lock.port.js";
import { SEARCH_INDEX_RETENTION, type SearchIndexRetentionPort } from "~projector/domain/index/port/search.index.retention.port.js";
import { SEARCH_INDEX_WRITER, type SearchIndexWriterPort } from "~projector/domain/index/port/search.index.writer.port.js";
import type { SearchOutboxDrainRepositories } from "~projector/domain/index/port/search.outbox.drain.repository.port.js";
import { ExportOtlpUseCase } from "~projector/domain/export/application/export.otlp.usecase.js";
import { HttpOtlpExporter } from "~projector/domain/export/adapter/http.otlp.exporter.js";
import { OtlpConsumer } from "~projector/domain/export/inbound/otlp.consumer.js";
import { OTLP_EXPORTER } from "~projector/domain/export/port/otlp.exporter.port.js";
import {
    DB_EVENT_CONSUMER,
    NOTIFICATION_PRODUCER,
    OTLP_EVENT_CONSUMER,
    OTLP_EXPORT_ENDPOINT,
    SEARCH_EVENT_CONSUMER,
} from "~projector/support/projector.tokens.js";

export interface OtlpExportDeps {
    readonly consumer: KafkaConsumer;
    readonly endpoint: string;
}

export interface ProjectorDeps {
    readonly database: TracerDatabase;
    readonly recoverLock: RecoverAdvisoryLockPort<RecoverLockScope>;
    readonly indexLock: IndexAdvisoryLockPort<SearchOutboxDrainRepositories>;
    readonly producer: KafkaProducer;
    readonly dbEventConsumer: KafkaConsumer;
    readonly searchEventConsumer: KafkaConsumer;
    readonly searchIndex: SearchIndexWriterPort & SearchIndexRetentionPort;
    readonly otlp?: OtlpExportDeps | undefined;
}

/** 다섯 기능 슬라이스의 포트 토큰을 실제 어댑터 인스턴스에 잇는 이 앱의 유일한 배선 지점이다. */
@Module({})
export class ProjectorModule {
    static forRoot(deps: ProjectorDeps): DynamicModule {
        const otlpProviders = deps.otlp
            ? [
                ExportOtlpUseCase,
                OtlpConsumer,
                { provide: OTLP_EXPORTER, useClass: HttpOtlpExporter },
                { provide: OTLP_EVENT_CONSUMER, useValue: deps.otlp.consumer },
                { provide: OTLP_EXPORT_ENDPOINT, useValue: deps.otlp.endpoint },
            ]
            : [];
        return {
            module: ProjectorModule,
            providers: [
                ArrivalProjection,
                RunProjection,
                RunSessionProjection,
                RunTaskProjection,
                TimelineProjection,
                RuleEvaluationProjection,
                RecipeProjection,
                ApplyLedgerBatchUseCase,
                DbConsumer,
                { provide: TRACER_DATABASE, useValue: deps.database },
                { provide: PROJECT_NOTIFICATION_PUBLISHER, useExisting: KafkaNotificationPublisher },

                NotifyUseCase,
                KafkaNotificationPublisher,
                { provide: NOTIFY_NOTIFICATION_PUBLISHER, useExisting: KafkaNotificationPublisher },
                { provide: NOTIFICATION_PRODUCER, useValue: deps.producer },

                TaskReaperService,
                AiJobStepReaperService,
                JobLeaseReaperService,
                { provide: RECOVER_ADVISORY_LOCK, useValue: deps.recoverLock },
                { provide: RECOVER_NOTIFICATION_PUBLISHER, useExisting: KafkaNotificationPublisher },

                IndexSearchUseCase,
                SearchOutboxDrainService,
                SearchEventsReaperService,
                SearchConsumer,
                { provide: INDEX_ADVISORY_LOCK, useValue: deps.indexLock },
                { provide: SEARCH_INDEX_WRITER, useValue: deps.searchIndex },
                { provide: SEARCH_INDEX_RETENTION, useValue: deps.searchIndex },

                { provide: DB_EVENT_CONSUMER, useValue: deps.dbEventConsumer },
                { provide: SEARCH_EVENT_CONSUMER, useValue: deps.searchEventConsumer },

                ...otlpProviders,
            ],
            exports: [
                DbConsumer,
                SearchConsumer,
                TaskReaperService,
                AiJobStepReaperService,
                JobLeaseReaperService,
                SearchOutboxDrainService,
                SearchEventsReaperService,
                ...(deps.otlp ? [OtlpConsumer] : []),
            ],
        };
    }
}
