import { Inject, Injectable } from "@nestjs/common";
import { TaskUserStateService } from "~tracer-api/domain/task/application/task.user.state.service.js";
import { TASK_REPOSITORY, type TaskRepositoryPort } from "~tracer-api/domain/task/port/task.repository.port.js";

export interface HideTaskResult {
    readonly taskId: string;
    readonly hidden: true;
    /** 요청된 태스크를 첫 원소로 두고 그 뒤에 서브에이전트 자손을 잇는, 함께 숨겨진 태스크 전체다. */
    readonly hiddenTaskIds: readonly string[];
}

@Injectable()
export class HideTaskUseCase {
    constructor(
        @Inject(TASK_REPOSITORY) private readonly tasks: TaskRepositoryPort,
        private readonly taskStates: TaskUserStateService,
    ) {}

    async execute(userId: string, taskId: string): Promise<HideTaskResult> {
        const descendantIds = await this.tasks.findDescendantIds(taskId, userId);
        const hiddenTaskIds = [taskId, ...descendantIds];
        await this.taskStates.hideAll(userId, hiddenTaskIds);
        return { taskId, hidden: true, hiddenTaskIds };
    }
}
