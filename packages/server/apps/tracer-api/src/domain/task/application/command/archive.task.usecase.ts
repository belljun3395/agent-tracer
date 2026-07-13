import { Injectable } from "@nestjs/common";
import { TaskUserStateService } from "~tracer-api/domain/task/application/task.user.state.service.js";

@Injectable()
export class ArchiveTaskUseCase {
    constructor(private readonly taskStates: TaskUserStateService) {}

    async execute(userId: string, taskId: string): Promise<{ readonly taskId: string; readonly archived: true }> {
        await this.taskStates.archive(userId, taskId);
        return { taskId, archived: true };
    }
}
