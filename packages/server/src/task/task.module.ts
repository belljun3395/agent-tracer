import { Module, type DynamicModule } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { SystemQueryController } from "./api/system.query.controller.js";
import { TaskCommandController } from "./api/task.command.controller.js";
import { TaskIngestController } from "./api/task.ingest.controller.js";
import { TaskQueryController } from "./api/task.query.controller.js";
import { CompleteTaskUseCase } from "./application/complete.task.usecase.js";
import { DeleteFinishedTasksUseCase } from "./application/delete.finished.tasks.usecase.js";
import { DeleteTaskUseCase } from "./application/delete.task.usecase.js";
import { ErrorTaskUseCase } from "./application/error.task.usecase.js";
import { GetDefaultWorkspacePathUseCase } from "./application/get.default.workspace.path.usecase.js";
import { GetOverviewUseCase } from "./application/get.overview.usecase.js";
import { GetTaskLatestRuntimeSessionUseCase } from "./application/get.task.latest.runtime.session.usecase.js";
import { GetTaskOpenInferenceUseCase } from "./application/get.task.open.inference.usecase.js";
import { GetTaskTimelineUseCase } from "./application/get.task.timeline.usecase.js";
import { GetTaskTurnsUseCase } from "./application/get.task.turns.usecase.js";
import { GetTaskUseCase } from "./application/get.task.usecase.js";
import { LinkTaskUseCase } from "./application/link.task.usecase.js";
import { ListTasksUseCase } from "./application/list.tasks.usecase.js";
import { StartTaskUseCase } from "./application/start.task.usecase.js";
import { UpdateTaskUseCase } from "./application/update.task.usecase.js";
import {
    EVENT_PROJECTION_ACCESS_PORT,
    NOTIFICATION_PUBLISHER_PORT,
    RUNTIME_BINDING_ACCESS_PORT,
    SESSION_ACCESS_PORT,
    TIMELINE_EVENT_ACCESS_PORT,
    TURN_QUERY_ACCESS_PORT,
} from "./application/outbound/tokens.js";
import { EventProjectionAccessAdapter } from "./adapter/event.projection.access.adapter.js";
import { RuntimeBindingAccessAdapter } from "./adapter/runtime.binding.access.adapter.js";
import { SessionAccessAdapter } from "./adapter/session.access.adapter.js";
import { TaskAccessPublicAdapter } from "./adapter/task.access.public.adapter.js";
import { TaskLifecyclePublicAdapter } from "./adapter/task.lifecycle.public.adapter.js";
import { TaskNotificationPublisherAdapter } from "./adapter/task.notification.publisher.adapter.js";
import { TimelineEventAccessAdapter } from "./adapter/timeline.event.access.adapter.js";
import { TurnQueryAccessAdapter } from "./adapter/turn.query.access.adapter.js";
import { TaskEntity } from "./domain/task.entity.js";
import { TaskRelationEntity } from "./domain/task.relation.entity.js";
import { TaskSnapshotQueryPublicAdapter } from "./adapter/task.snapshot.query.public.adapter.js";
import { TASK_ACCESS, TASK_LIFECYCLE, TASK_SNAPSHOT_QUERY } from "./public/tokens.js";
import { TaskRelationRepository } from "./repository/task.relation.repository.js";
import { TaskRepository } from "./repository/task.repository.js";
import { TaskLifecycleService } from "./service/task.lifecycle.service.js";
import { TaskManagementService } from "./service/task.management.service.js";
import { TaskQueryService } from "./service/task.query.service.js";
import { TaskEventLogEntity } from "./subscriber/event.log.entity.js";
import {
    TaskEntitySubscriber,
    TaskRelationEntitySubscriber,
} from "./subscriber/task.event.subscriber.js";

/**
 * Task module — owns TaskEntity, TaskRelationEntity.
 *
 * Public surface:
 *   - TASK_LIFECYCLE  (ITaskLifecycle) — for session module's outbound port
 *   - TASK_ACCESS     (ITaskAccess)    — for session module's outbound port
 *
 * Outbound surface (consumed via adapters):
 *   - SESSION_ACCESS_PORT          → SessionAccessAdapter wraps SESSION_LIFECYCLE
 *   - RUNTIME_BINDING_ACCESS_PORT  → RuntimeBindingAccessAdapter wraps RUNTIME_BINDING_LOOKUP
 *   - TIMELINE_EVENT_ACCESS_PORT   → wraps legacy IEventRepository
 *   - TURN_QUERY_ACCESS_PORT       → wraps legacy TurnSummaryQueryPort
 *   - NOTIFICATION_PUBLISHER_PORT  → wraps shared NOTIFICATION_PUBLISHER_TOKEN
 */
@Module({})
export class TaskModule {
    static register(databaseModule: DynamicModule): DynamicModule {
        return {
            module: TaskModule,
            global: true,
            imports: [
                TypeOrmModule.forFeature([TaskEntity, TaskRelationEntity, TaskEventLogEntity]),
                databaseModule,
            ],
            controllers: [TaskCommandController, TaskIngestController, TaskQueryController, SystemQueryController],
            providers: [
                TaskRepository,
                TaskRelationRepository,
                TaskQueryService,
                TaskManagementService,
                TaskLifecycleService,
                // Entity subscribers — emit task.created/renamed/status_changed/hierarchy_changed
                TaskEntitySubscriber,
                TaskRelationEntitySubscriber,
                // Outbound adapters
                SessionAccessAdapter,
                RuntimeBindingAccessAdapter,
                TimelineEventAccessAdapter,
                TurnQueryAccessAdapter,
                TaskNotificationPublisherAdapter,
                EventProjectionAccessAdapter,
                // Public adapters
                TaskAccessPublicAdapter,
                TaskLifecyclePublicAdapter,
                TaskSnapshotQueryPublicAdapter,
                // Use cases
                StartTaskUseCase,
                CompleteTaskUseCase,
                ErrorTaskUseCase,
                UpdateTaskUseCase,
                LinkTaskUseCase,
                DeleteTaskUseCase,
                DeleteFinishedTasksUseCase,
                ListTasksUseCase,
                GetTaskUseCase,
                GetTaskTimelineUseCase,
                GetTaskTurnsUseCase,
                GetTaskLatestRuntimeSessionUseCase,
                GetTaskOpenInferenceUseCase,
                GetOverviewUseCase,
                GetDefaultWorkspacePathUseCase,
                // Public iservices
                { provide: TASK_LIFECYCLE, useExisting: TaskLifecyclePublicAdapter },
                { provide: TASK_ACCESS, useExisting: TaskAccessPublicAdapter },
                { provide: TASK_SNAPSHOT_QUERY, useExisting: TaskSnapshotQueryPublicAdapter },
                // Outbound ports
                { provide: SESSION_ACCESS_PORT, useExisting: SessionAccessAdapter },
                { provide: RUNTIME_BINDING_ACCESS_PORT, useExisting: RuntimeBindingAccessAdapter },
                { provide: TIMELINE_EVENT_ACCESS_PORT, useExisting: TimelineEventAccessAdapter },
                { provide: TURN_QUERY_ACCESS_PORT, useExisting: TurnQueryAccessAdapter },
                { provide: NOTIFICATION_PUBLISHER_PORT, useExisting: TaskNotificationPublisherAdapter },
                { provide: EVENT_PROJECTION_ACCESS_PORT, useExisting: EventProjectionAccessAdapter },
            ],
            exports: [TASK_LIFECYCLE, TASK_ACCESS, TASK_SNAPSHOT_QUERY],
        };
    }
}
