import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { EVENT_READER, type EventReaderPort } from "~tracer-api/domain/task/port/event.reader.port.js";
import { TASK_REPOSITORY, type TaskRepositoryPort } from "~tracer-api/domain/task/port/task.repository.port.js";

export interface TaskUserInputDto {
    readonly eventId: string;
    readonly text: string;
    readonly turnId: string | null;
    readonly occurredAt: string;
}

/** 규칙의 근거로 지정할 수 있는 사용자 입력 목록이다. */
@Injectable()
export class ListTaskUserInputsUseCase {
    constructor(
        @Inject(TASK_REPOSITORY) private readonly tasks: TaskRepositoryPort,
        @Inject(EVENT_READER) private readonly events: EventReaderPort,
    ) {}

    async execute(userId: string, taskId: string): Promise<{ readonly items: readonly TaskUserInputDto[] }> {
        const task = await this.tasks.findById(taskId);
        // 남의 태스크는 존재 여부도 드러내지 않는다.
        if (task === null || task.userId !== userId) throw new NotFoundException("Task not found");

        const events = await this.events.findUserMessagesByTask(taskId);
        return {
            items: events.map((event) => ({
                eventId: event.id,
                text: event.body ?? event.title,
                turnId: event.turnId,
                occurredAt: event.occurredAt.toISOString(),
            })),
        };
    }
}
