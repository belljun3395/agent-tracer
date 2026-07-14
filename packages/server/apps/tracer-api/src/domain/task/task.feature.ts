import { SystemClock } from "@monitor/platform";
import {
    EventRepository,
    SessionRepository,
    TaskRepository,
    TaskUserStateRepository,
    TurnRepository,
    VerdictRepository,
} from "@monitor/tracer-domain";
import { ArchiveTaskUseCase } from "~tracer-api/domain/task/application/command/archive.task.usecase.js";
import { HideTaskUseCase } from "~tracer-api/domain/task/application/command/hide.task.usecase.js";
import { RenameTaskUseCase } from "~tracer-api/domain/task/application/command/rename.task.usecase.js";
import { SetTaskStatusUseCase } from "~tracer-api/domain/task/application/command/set.task.status.usecase.js";
import { UnarchiveTaskUseCase } from "~tracer-api/domain/task/application/command/unarchive.task.usecase.js";
import { ExportOpenInferenceUseCase } from "~tracer-api/domain/task/application/export/export.openinference.usecase.js";
import { GetTaskUseCase } from "~tracer-api/domain/task/application/query/get.task.usecase.js";
import { ListChildTasksUseCase } from "~tracer-api/domain/task/application/query/list.child.tasks.usecase.js";
import { ListTaskUserInputsUseCase } from "~tracer-api/domain/task/application/query/list.task.user.inputs.usecase.js";
import { ListTasksUseCase } from "~tracer-api/domain/task/application/query/list.tasks.usecase.js";
import { ListTurnsUseCase } from "~tracer-api/domain/task/application/query/list.turns.usecase.js";
import { TaskUserStateService } from "~tracer-api/domain/task/application/task.user.state.service.js";
import { OpenSearchTaskIndex } from "~tracer-api/domain/task/adapter/opensearch.task.index.js";
import { CLOCK } from "~tracer-api/domain/task/port/clock.port.js";
import { EVENT_READER } from "~tracer-api/domain/task/port/event.reader.port.js";
import { SESSION_READER } from "~tracer-api/domain/task/port/session.reader.port.js";
import { TASK_REPOSITORY } from "~tracer-api/domain/task/port/task.repository.port.js";
import { TASK_SEARCH_INDEX } from "~tracer-api/domain/task/port/task.search.index.port.js";
import { TASK_USER_STATE_REPOSITORY } from "~tracer-api/domain/task/port/task.user.state.repository.port.js";
import { TURN_READER } from "~tracer-api/domain/task/port/turn.reader.port.js";
import { VERDICT_READER } from "~tracer-api/domain/task/port/verdict.reader.port.js";
import { TaskActivityController } from "~tracer-api/domain/task/inbound/task.activity.controller.js";
import { TaskCommandController } from "~tracer-api/domain/task/inbound/task.command.controller.js";
import { TaskExportController } from "~tracer-api/domain/task/inbound/task.export.controller.js";
import { TaskQueryController } from "~tracer-api/domain/task/inbound/task.query.controller.js";

export const taskFeature = {
    controllers: [TaskQueryController, TaskActivityController, TaskExportController, TaskCommandController],
    providers: [
        ArchiveTaskUseCase,
        HideTaskUseCase,
        RenameTaskUseCase,
        SetTaskStatusUseCase,
        UnarchiveTaskUseCase,
        ExportOpenInferenceUseCase,
        GetTaskUseCase,
        ListChildTasksUseCase,
        ListTasksUseCase,
        ListTaskUserInputsUseCase,
        ListTurnsUseCase,
        TaskUserStateService,
        OpenSearchTaskIndex,
        { provide: TASK_REPOSITORY, useExisting: TaskRepository },
        { provide: TASK_USER_STATE_REPOSITORY, useExisting: TaskUserStateRepository },
        { provide: SESSION_READER, useExisting: SessionRepository },
        { provide: EVENT_READER, useExisting: EventRepository },
        { provide: TURN_READER, useExisting: TurnRepository },
        { provide: VERDICT_READER, useExisting: VerdictRepository },
        { provide: TASK_SEARCH_INDEX, useExisting: OpenSearchTaskIndex },
        { provide: CLOCK, useClass: SystemClock },
    ],
};
