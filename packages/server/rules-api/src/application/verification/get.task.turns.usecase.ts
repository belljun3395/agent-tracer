import { Injectable } from "@nestjs/common";
import { TurnQueryRepository } from "../../repository/verification/turn.query.repository.js";
import type {
    GetTaskTurnsUseCaseIn,
    GetTaskTurnsUseCaseOut,
    TaskTurnAggregateVerdictUseCaseDto,
    TaskTurnStatusUseCaseDto,
} from "./dto/get.task.turns.usecase.dto.js";

@Injectable()
export class GetTaskTurnsUseCase {
    constructor(private readonly turns: TurnQueryRepository) {}

    async execute(input: GetTaskTurnsUseCaseIn): Promise<GetTaskTurnsUseCaseOut> {
        const summaries = await this.turns.listTurnSummariesForTask(input.taskId);
        return {
            turns: summaries.map((turn) => ({
                id: turn.id,
                sessionId: turn.sessionId,
                taskId: turn.taskId,
                turnIndex: turn.turnIndex,
                status: turn.status as TaskTurnStatusUseCaseDto,
                startedAt: turn.startedAt,
                endedAt: turn.endedAt ?? null,
                aggregateVerdict: (turn.aggregateVerdict ?? null) as TaskTurnAggregateVerdictUseCaseDto | null,
                rulesEvaluatedCount: turn.rulesEvaluatedCount ?? 0,
            })),
        };
    }
}
