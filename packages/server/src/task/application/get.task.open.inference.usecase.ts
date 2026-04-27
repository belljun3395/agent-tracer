import { Inject, Injectable } from "@nestjs/common";
import type { TimelineEvent } from "~domain/monitoring/event/model/timeline.event.model.js";
import { TaskQueryService } from "../service/task.query.service.js";
import { TaskOpenInferenceExport } from "../domain/task.openinference.export.model.js";
import { TIMELINE_EVENT_ACCESS_PORT } from "./outbound/tokens.js";
import type { ITimelineEventAccess } from "./outbound/timeline.event.access.port.js";
import type {
    GetTaskOpenInferenceUseCaseIn,
    GetTaskOpenInferenceUseCaseOut,
} from "./dto/get.task.open.inference.usecase.dto.js";

@Injectable()
export class GetTaskOpenInferenceUseCase {
    constructor(
        private readonly query: TaskQueryService,
        @Inject(TIMELINE_EVENT_ACCESS_PORT) private readonly events: ITimelineEventAccess,
    ) {}

    async execute(input: GetTaskOpenInferenceUseCaseIn): Promise<GetTaskOpenInferenceUseCaseOut | undefined> {
        const task = await this.query.findById(input.taskId);
        if (!task) return undefined;
        const timeline = await this.events.findByTaskId(input.taskId);
        const exported = new TaskOpenInferenceExport(task, timeline as unknown as readonly TimelineEvent[]).toRecord();
        return { openinference: exported };
    }
}
