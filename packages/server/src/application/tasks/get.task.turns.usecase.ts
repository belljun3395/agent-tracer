import type { ITurnQueryRepository } from "~application/ports/repository/turn.query.repository.js";
import type { GetTaskTurnsUseCaseIn, GetTaskTurnsUseCaseOut } from "./dto/get.task.turns.usecase.dto.js";

export class GetTaskTurnsUseCase {
    constructor(private readonly turns: ITurnQueryRepository) {}

    async execute(input: GetTaskTurnsUseCaseIn): Promise<GetTaskTurnsUseCaseOut> {
        return {
            turns: await this.turns.listTurnSummariesForTask(input.taskId),
        };
    }
}
