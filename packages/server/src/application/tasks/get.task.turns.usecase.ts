import type { TurnSummaryQueryPort } from "~application/ports/index.js";
import type { GetTaskTurnsUseCaseIn, GetTaskTurnsUseCaseOut } from "./dto/get.task.turns.usecase.dto.js";

export class GetTaskTurnsUseCase {
    constructor(private readonly turns: TurnSummaryQueryPort) {}

    async execute(input: GetTaskTurnsUseCaseIn): Promise<GetTaskTurnsUseCaseOut> {
        return {
            turns: await this.turns.listTurnSummariesForTask(input.taskId),
        };
    }
}
