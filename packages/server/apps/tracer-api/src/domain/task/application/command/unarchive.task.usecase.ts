import { Injectable } from "@nestjs/common";
import { TaskUserStateService } from "~tracer-api/domain/task/application/task.user.state.service.js";

@Injectable()
export class UnarchiveTaskUseCase {
    constructor(private readonly taskStates: TaskUserStateService) {}

    async execute(userId: string, taskId: string): Promise<{ readonly taskId: string; readonly archived: false }> {
        await this.taskStates.unarchive(userId, taskId);
        return { taskId, archived: false };
    }
}
