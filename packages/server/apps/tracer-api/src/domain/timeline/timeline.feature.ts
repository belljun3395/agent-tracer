import type { Provider, Type } from "@nestjs/common";
import { EventRepository, RuleRepository, TaskRepository, TurnRepository, VerdictRepository } from "@monitor/tracer-domain";
import { GetTimelineUseCase } from "~tracer-api/domain/timeline/application/get.timeline.usecase.js";
import { GetTaskVerificationsUseCase } from "~tracer-api/domain/timeline/application/query/get.task.verifications.usecase.js";
import { TIMELINE_EVENT_READER } from "~tracer-api/domain/timeline/port/event.reader.port.js";
import { TIMELINE_TASK_READER } from "~tracer-api/domain/timeline/port/task.reader.port.js";
import { RULE_REPOSITORY } from "~tracer-api/domain/timeline/port/rule.repository.port.js";
import { RULE_TASK_READER } from "~tracer-api/domain/timeline/port/rule.task.reader.port.js";
import { RULE_TURN_REPOSITORY } from "~tracer-api/domain/timeline/port/turn.repository.port.js";
import { RULE_VERDICT_REPOSITORY } from "~tracer-api/domain/timeline/port/verdict.repository.port.js";
import { TimelineController } from "~tracer-api/domain/timeline/inbound/timeline.controller.js";

export const timelineFeature: { readonly controllers: readonly Type[]; readonly providers: readonly Provider[] } = {
    controllers: [TimelineController],
    providers: [
        GetTimelineUseCase,
        GetTaskVerificationsUseCase,
        { provide: TIMELINE_EVENT_READER, useExisting: EventRepository },
        { provide: TIMELINE_TASK_READER, useExisting: TaskRepository },
        { provide: RULE_REPOSITORY, useExisting: RuleRepository },
        { provide: RULE_TURN_REPOSITORY, useExisting: TurnRepository },
        { provide: RULE_VERDICT_REPOSITORY, useExisting: VerdictRepository },
        { provide: RULE_TASK_READER, useExisting: TaskRepository },
    ],
};
