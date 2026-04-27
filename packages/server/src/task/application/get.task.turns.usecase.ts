import { Inject, Injectable } from "@nestjs/common";
import { TURN_QUERY_ACCESS_PORT } from "./outbound/tokens.js";
import type { ITurnQueryAccess } from "./outbound/turn.query.access.port.js";
import type { GetTaskTurnsUseCaseIn, GetTaskTurnsUseCaseOut } from "./dto/get.task.turns.usecase.dto.js";

@Injectable()
export class GetTaskTurnsUseCase {
    constructor(
        @Inject(TURN_QUERY_ACCESS_PORT) private readonly turns: ITurnQueryAccess,
    ) {}

    async execute(input: GetTaskTurnsUseCaseIn): Promise<GetTaskTurnsUseCaseOut> {
        return {
            turns: await this.turns.listTurnSummariesForTask(input.taskId) as never,
        };
    }
}
