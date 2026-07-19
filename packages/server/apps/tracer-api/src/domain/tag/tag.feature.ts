import { TagRepository, TaskTagRepository, TransactionRunner } from "@monitor/tracer-domain";
import { SystemClock } from "@monitor/platform";
import { CreateTagUseCase } from "~tracer-api/domain/tag/application/command/create.tag.usecase.js";
import { DeleteTagUseCase } from "~tracer-api/domain/tag/application/command/delete.tag.usecase.js";
import { SetTaskTagsUseCase } from "~tracer-api/domain/tag/application/command/set.task.tags.usecase.js";
import { UpdateTagUseCase } from "~tracer-api/domain/tag/application/command/update.tag.usecase.js";
import { GetTaskTagsUseCase } from "~tracer-api/domain/tag/application/query/get.task.tags.usecase.js";
import { GetTasksByTagUseCase } from "~tracer-api/domain/tag/application/query/get.tasks.by.tag.usecase.js";
import { ListTagsUseCase } from "~tracer-api/domain/tag/application/query/list.tags.usecase.js";
import { TagController } from "~tracer-api/domain/tag/inbound/tag.controller.js";
import { TaskTagController } from "~tracer-api/domain/tag/inbound/task.tag.controller.js";
import { CLOCK } from "~tracer-api/domain/tag/port/clock.port.js";
import { TAG_REPOSITORY } from "~tracer-api/domain/tag/port/tag.repository.port.js";
import { TAG_TRANSACTION } from "~tracer-api/domain/tag/port/tag.transaction.port.js";
import { TASK_TAG_REPOSITORY } from "~tracer-api/domain/tag/port/task.tag.repository.port.js";

/** tag 슬라이스가 조립 근원에 공급하는 컨트롤러와 프로바이더 목록이다. */
export const tagFeature = {
    controllers: [TagController, TaskTagController],
    providers: [
        ListTagsUseCase,
        GetTaskTagsUseCase,
        GetTasksByTagUseCase,
        CreateTagUseCase,
        UpdateTagUseCase,
        DeleteTagUseCase,
        SetTaskTagsUseCase,
        { provide: CLOCK, useClass: SystemClock },
        { provide: TAG_REPOSITORY, useExisting: TagRepository },
        { provide: TASK_TAG_REPOSITORY, useExisting: TaskTagRepository },
        { provide: TAG_TRANSACTION, useExisting: TransactionRunner },
    ],
};
