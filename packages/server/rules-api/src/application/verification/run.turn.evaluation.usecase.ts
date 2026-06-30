import { Transactional } from "typeorm-transactional";
import type { RunTurnEvaluationUseCaseIn, RunTurnEvaluationUseCaseOut } from "./dto/run.turn.evaluation.usecase.dto.js";
import type { TurnEvaluationService } from "../../service/verification/turn.evaluation.service.js";

export class RunTurnEvaluationUseCase {
    constructor(private readonly turnEvaluation: TurnEvaluationService) {}

    @Transactional()
    execute(input: RunTurnEvaluationUseCaseIn): Promise<RunTurnEvaluationUseCaseOut> {
        return this.turnEvaluation.evaluate(input);
    }
}
