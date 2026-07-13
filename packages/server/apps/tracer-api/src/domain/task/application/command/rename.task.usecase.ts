import { Injectable } from "@nestjs/common";
import { TaskUserStateService } from "~tracer-api/domain/task/application/task.user.state.service.js";

@Injectable()
export class RenameTaskUseCase {
    constructor(private readonly taskStates: TaskUserStateService) {}

    async execute(userId: string, taskId: string, title: string): Promise<{ readonly taskId: string; readonly title: string }> {
        await this.taskStates.rename(userId, taskId, title);
        return { taskId, title };
    }
}
