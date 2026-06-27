import { Inject, Injectable } from "@nestjs/common";
import { TaskQueryService } from "../service/task.query.service.js";
import { TaskOpenInferenceExport } from "../domain/task.openinference.export.model.js";
import { TIMELINE_EVENT_READ } from "@monitor/timeline-api/event/public/tokens.js";
import type { ITimelineEventRead } from "@monitor/timeline-api/event/public/iservice/timeline.event.read.iservice.js";
import type {
    GetTaskOpenInferenceUseCaseIn,
    GetTaskOpenInferenceUseCaseOut,
} from "./dto/get.task.open.inference.usecase.dto.js";

@Injectable()
export class GetTaskOpenInferenceUseCase {
    constructor(
        private readonly query: TaskQueryService,
        @Inject(TIMELINE_EVENT_READ) private readonly events: ITimelineEventRead,
    ) {}

    async execute(input: GetTaskOpenInferenceUseCaseIn): Promise<GetTaskOpenInferenceUseCaseOut | undefined> {
        const task = await this.query.findById(input.taskId);
        if (!task) return undefined;
        const timeline = await this.events.findByTaskId(input.taskId);
        const exported = new TaskOpenInferenceExport(task, timeline).toRecord();
        return { openinference: exported };
    }
}
