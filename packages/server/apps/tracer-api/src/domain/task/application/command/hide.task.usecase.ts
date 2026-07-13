import { Injectable } from "@nestjs/common";
import { TaskUserStateService } from "~tracer-api/domain/task/application/task.user.state.service.js";

@Injectable()
export class HideTaskUseCase {
    constructor(private readonly taskStates: TaskUserStateService) {}

    async execute(userId: string, taskId: string): Promise<{ readonly taskId: string; readonly hidden: true }> {
        await this.taskStates.hide(userId, taskId);
        return { taskId, hidden: true };
    }
}
