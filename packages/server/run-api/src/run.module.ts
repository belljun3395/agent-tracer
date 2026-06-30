import { Module, type DynamicModule } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

// ── session ───────────────────────────────────────────────────────────────────
import { SessionIngestController } from "./api/session/session.ingest.controller.js";
import { EndRuntimeSessionUseCase } from "./application/session/end.runtime.session.usecase.js";
import { EnsureRuntimeSessionUseCase } from "./application/session/ensure.runtime.session.usecase.js";
import { SessionNotificationPublisherAdapter } from "./adapter/session/session.notification.publisher.adapter.js";
import { RuntimeBindingEntity } from "./domain/session/runtime.binding.entity.js";
import { SessionEntity } from "./domain/session/session.entity.js";
import { RuntimeBindingRepository } from "./repository/session/runtime.binding.repository.js";
import { SessionRepository } from "./repository/session/session.repository.js";
import { NOTIFICATION_PUBLISHER_PORT as SESSION_NOTIFICATION_PORT } from "./application/session/outbound/tokens.js";

// ── task ──────────────────────────────────────────────────────────────────────
import { SystemQueryController } from "./api/task/system.query.controller.js";
import { TaskController } from "./api/task/task.controller.js";
import { TaskIngestController } from "./api/task/task.ingest.controller.js";
import { ArchiveTaskUseCase } from "./application/task/archive.task.usecase.js";
import { CompleteTaskUseCase } from "./application/task/complete.task.usecase.js";
import { DeleteTaskUseCase } from "./application/task/delete.task.usecase.js";
import { ErrorTaskUseCase } from "./application/task/error.task.usecase.js";
import { GetDefaultWorkspacePathUseCase } from "./application/task/get.default.workspace.path.usecase.js";
import { GetOverviewUseCase } from "./application/task/get.overview.usecase.js";
import { GetTaskLatestRuntimeSessionUseCase } from "./application/task/get.task.latest.runtime.session.usecase.js";
import { GetTaskOpenInferenceUseCase } from "./application/task/get.task.open.inference.usecase.js";
import { GetTaskSummaryUseCase } from "./application/task/get.task.summary.usecase.js";
import { GetTaskTimelineUseCase } from "./application/task/get.task.timeline.usecase.js";
import { GetTaskTurnsUseCase } from "./application/task/get.task.turns.usecase.js";
import { GetTaskUseCase } from "./application/task/get.task.usecase.js";
import { LinkTaskUseCase } from "./application/task/link.task.usecase.js";
import { ListTasksUseCase } from "./application/task/list.tasks.usecase.js";
import { ReslugTaskUseCase } from "./application/task/reslug.task.usecase.js";
import { SearchTasksUseCase } from "./application/task/search.tasks.usecase.js";
import { StartTaskUseCase } from "./application/task/start.task.usecase.js";
import { SuggestTaskTitleUseCase } from "./application/task/suggest.task.title.usecase.js";
import { UnarchiveTaskUseCase } from "./application/task/unarchive.task.usecase.js";
import { UpdateTaskUseCase } from "./application/task/update.task.usecase.js";
import { TaskMaintenanceFacade } from "./application/task/task.maintenance.facade.js";
import { NOTIFICATION_PUBLISHER_PORT as TASK_NOTIFICATION_PORT } from "./application/task/outbound/tokens.js";
import { TaskAccessPublicAdapter } from "./adapter/task/task.access.public.adapter.js";
import { TaskNotificationPublisherAdapter } from "./adapter/task/task.notification.publisher.adapter.js";
import { TaskEntity } from "./domain/task/task.entity.js";
import { TaskRelationEntity } from "./domain/task/task.relation.entity.js";
import {
    TASK_MAINTENANCE,
    TASK_SNAPSHOT_QUERY,
    TASK_SUMMARY,
} from "./public/task/tokens.js";
import { TaskRelationRepository } from "./repository/task/task.relation.repository.js";
import { TaskRepository } from "./repository/task/task.repository.js";
import { StaleTaskReaperJob } from "./scheduling/task/stale.task.reaper.job.js";
import { StuckServerSdkTaskReaperJob } from "./scheduling/task/stuck.server.sdk.task.reaper.job.js";
import { TaskLifecycleService } from "./service/task/task.lifecycle.service.js";
import { TaskManagementService } from "./service/task/task.management.service.js";
import { TaskReadService } from "./service/task/task.read.service.js";
import { EventRecordedTaskEffectSubscriber } from "./subscriber/task/event.recorded.task.effect.subscriber.js";

// ── turn ──────────────────────────────────────────────────────────────────────
import { TurnPartitionController } from "./api/turn/turn.partition.controller.js";
import { GetTurnPartitionUseCase } from "./application/turn/get.turn.partition.usecase.js";
import { ResetTurnPartitionUseCase } from "./application/turn/reset.turn.partition.usecase.js";
import { UpsertTurnPartitionUseCase } from "./application/turn/upsert.turn.partition.usecase.js";
import { TurnPartitionEntity } from "./domain/turn/turn.partition.entity.js";
import { TurnPartitionRepository } from "./repository/turn/turn.partition.repository.js";

@Module({})
export class RunModule {
    static register(databaseModule: DynamicModule): DynamicModule {
        return {
            module: RunModule,
            imports: [
                TypeOrmModule.forFeature([
                    SessionEntity,
                    RuntimeBindingEntity,
                    TaskEntity,
                    TaskRelationEntity,
                    TurnPartitionEntity,
                ]),
                databaseModule,
            ],
            controllers: [
                SessionIngestController,
                TaskController,
                TaskIngestController,
                SystemQueryController,
                TurnPartitionController,
            ],
            providers: [
                // ── session ──
                SessionRepository,
                RuntimeBindingRepository,
                SessionNotificationPublisherAdapter,
                EnsureRuntimeSessionUseCase,
                EndRuntimeSessionUseCase,
                { provide: SESSION_NOTIFICATION_PORT, useExisting: SessionNotificationPublisherAdapter },

                // ── task ──
                TaskRepository,
                TaskRelationRepository,
                TaskReadService,
                TaskManagementService,
                TaskLifecycleService,
                TaskAccessPublicAdapter,
                TaskNotificationPublisherAdapter,
                StaleTaskReaperJob,
                StuckServerSdkTaskReaperJob,
                EventRecordedTaskEffectSubscriber,
                StartTaskUseCase,
                CompleteTaskUseCase,
                ErrorTaskUseCase,
                UpdateTaskUseCase,
                LinkTaskUseCase,
                DeleteTaskUseCase,
                ArchiveTaskUseCase,
                UnarchiveTaskUseCase,
                ReslugTaskUseCase,
                SuggestTaskTitleUseCase,
                ListTasksUseCase,
                SearchTasksUseCase,
                GetTaskUseCase,
                GetTaskTimelineUseCase,
                GetTaskSummaryUseCase,
                GetTaskTurnsUseCase,
                GetTaskLatestRuntimeSessionUseCase,
                GetTaskOpenInferenceUseCase,
                GetOverviewUseCase,
                GetDefaultWorkspacePathUseCase,
                TaskMaintenanceFacade,
                { provide: TASK_SNAPSHOT_QUERY, useExisting: TaskReadService },
                { provide: TASK_SUMMARY, useExisting: GetTaskSummaryUseCase },
                { provide: TASK_MAINTENANCE, useExisting: TaskMaintenanceFacade },
                { provide: TASK_NOTIFICATION_PORT, useExisting: TaskNotificationPublisherAdapter },

                // ── turn ──
                TurnPartitionRepository,
                GetTurnPartitionUseCase,
                UpsertTurnPartitionUseCase,
                ResetTurnPartitionUseCase,
            ],
            exports: [
                TASK_SNAPSHOT_QUERY,
                TASK_SUMMARY,
                TASK_MAINTENANCE,
                TaskReadService,
                TaskManagementService,
                TaskLifecycleService,
                TaskAccessPublicAdapter,
                TurnPartitionRepository,
            ],
        };
    }
}
