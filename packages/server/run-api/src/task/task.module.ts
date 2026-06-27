import { Module, type DynamicModule } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { TurnPartitionController } from "./turn/api/turn.partition.controller.js";
import { TurnPartitionRepository } from "./turn/repository/turn.partition.repository.js";
import { TaskAccessAdapter as TurnTaskAccessAdapter } from "./turn/adapter/task.access.adapter.js";
import { TimelineEventAccessAdapter as TurnTimelineEventAccessAdapter } from "./turn/adapter/timeline.event.access.adapter.js";
import { GetTurnPartitionUseCase } from "./turn/application/get.turn.partition.usecase.js";
import { UpsertTurnPartitionUseCase } from "./turn/application/upsert.turn.partition.usecase.js";
import { ResetTurnPartitionUseCase } from "./turn/application/reset.turn.partition.usecase.js";
import { TurnPartitionEntity } from "./turn/domain/turn.partition.entity.js";
import {
    TASK_ACCESS_PORT as TURN_TASK_ACCESS_PORT,
    TIMELINE_EVENT_ACCESS_PORT as TURN_TIMELINE_EVENT_ACCESS_PORT,
} from "./turn/application/outbound/tokens.js";
import { SystemQueryController } from "./api/system.query.controller.js";
import { TaskController } from "./api/task.controller.js";
import { TaskIngestController } from "./api/task.ingest.controller.js";
import { ArchiveTaskUseCase } from "./application/archive.task.usecase.js";
import { CompleteTaskUseCase } from "./application/complete.task.usecase.js";
import { DeleteTaskUseCase } from "./application/delete.task.usecase.js";
import { ReslugTaskUseCase } from "./application/reslug.task.usecase.js";
import { SuggestTaskTitleUseCase } from "./application/suggest.task.title.usecase.js";
import { TitleSuggestionAgent } from "./application/title.suggestion.agent.js";
import { MessagesQueryRunner } from "@monitor/shared/llm/messages.query.runner.js";
import { QUERY_RUNNER } from "@monitor/shared/llm/query.runner.port.js";
import { UnarchiveTaskUseCase } from "./application/unarchive.task.usecase.js";
import { ErrorTaskUseCase } from "./application/error.task.usecase.js";
import { GetDefaultWorkspacePathUseCase } from "./application/get.default.workspace.path.usecase.js";
import { GetOverviewUseCase } from "./application/get.overview.usecase.js";
import { GetTaskLatestRuntimeSessionUseCase } from "./application/get.task.latest.runtime.session.usecase.js";
import { GetTaskOpenInferenceUseCase } from "./application/get.task.open.inference.usecase.js";
import { GetTaskSummaryUseCase } from "./application/get.task.summary.usecase.js";
import { GetTaskTimelineUseCase } from "./application/get.task.timeline.usecase.js";
import { GetTaskTurnsUseCase } from "./application/get.task.turns.usecase.js";
import { GetTaskUseCase } from "./application/get.task.usecase.js";
import { LinkTaskUseCase } from "./application/link.task.usecase.js";
import { ListTasksUseCase } from "./application/list.tasks.usecase.js";
import { SearchTasksUseCase } from "./application/search.tasks.usecase.js";
import { StartTaskUseCase } from "./application/start.task.usecase.js";
import { UpdateTaskUseCase } from "./application/update.task.usecase.js";
import { NOTIFICATION_PUBLISHER_PORT } from "./application/outbound/tokens.js";
import { TaskAccessPublicAdapter } from "./adapter/task.access.public.adapter.js";
import { TaskNotificationPublisherAdapter } from "./adapter/task.notification.publisher.adapter.js";
import { TaskEntity } from "./domain/task.entity.js";
import { TaskRelationEntity } from "./domain/task.relation.entity.js";
import { TASK_ACCESS, TASK_LIFECYCLE, TASK_SNAPSHOT_QUERY } from "./public/tokens.js";
import { TaskRelationRepository } from "./repository/task.relation.repository.js";
import { TaskRepository } from "./repository/task.repository.js";
import { StaleTaskReaperService } from "./service/stale.task.reaper.service.js";
import { StuckServerSdkTaskReaperService } from "./service/stuck.server.sdk.task.reaper.service.js";
import { TaskLifecycleService } from "./service/task.lifecycle.service.js";
import { TaskManagementService } from "./service/task.management.service.js";
import { TaskQueryService } from "./service/task.query.service.js";
import { EventRecordedTaskEffectSubscriber } from "./subscriber/event.recorded.task.effect.subscriber.js";

@Module({})
export class TaskModule {
    static register(databaseModule: DynamicModule): DynamicModule {
        return {
            module: TaskModule,
            imports: [
                TypeOrmModule.forFeature([TaskEntity, TaskRelationEntity, TurnPartitionEntity]),
                databaseModule,
            ],
            controllers: [TaskController, TaskIngestController, SystemQueryController, TurnPartitionController],
            providers: [
                TaskRepository,
                TaskRelationRepository,
                TaskQueryService,
                TaskManagementService,
                TaskLifecycleService,
                StaleTaskReaperService,
                StuckServerSdkTaskReaperService,

                EventRecordedTaskEffectSubscriber,

                TaskNotificationPublisherAdapter,

                TaskAccessPublicAdapter,

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

                TitleSuggestionAgent,
                MessagesQueryRunner,
                { provide: QUERY_RUNNER, useExisting: MessagesQueryRunner },
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

                TurnPartitionRepository,
                TurnTaskAccessAdapter,
                TurnTimelineEventAccessAdapter,
                GetTurnPartitionUseCase,
                UpsertTurnPartitionUseCase,
                ResetTurnPartitionUseCase,
                { provide: TURN_TASK_ACCESS_PORT, useExisting: TurnTaskAccessAdapter },
                { provide: TURN_TIMELINE_EVENT_ACCESS_PORT, useExisting: TurnTimelineEventAccessAdapter },

                { provide: TASK_LIFECYCLE, useExisting: TaskLifecycleService },
                { provide: TASK_ACCESS, useExisting: TaskAccessPublicAdapter },
                { provide: TASK_SNAPSHOT_QUERY, useExisting: TaskQueryService },

                { provide: NOTIFICATION_PUBLISHER_PORT, useExisting: TaskNotificationPublisherAdapter },
            ],
            exports: [
                TASK_LIFECYCLE,
                TASK_ACCESS,
                TASK_SNAPSHOT_QUERY,
                GetTaskSummaryUseCase,
                ArchiveTaskUseCase,
                UpdateTaskUseCase,
                LinkTaskUseCase,
                ReslugTaskUseCase,
            ],
        };
    }
}
