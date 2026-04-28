import type { RunTurnEvaluationUseCaseIn, RunTurnEvaluationUseCaseOut } from "./dto/run.turn.evaluation.usecase.dto.js";
import type { TurnEvaluationService } from "../service/turn.evaluation.service.js";

/**
 * Application entry point for explicit per-turn evaluation.
 *
 * Event-driven turn closing uses TurnLifecyclePostProcessor directly; this
 * use case remains a thin boundary for callers that need to trigger a turn
 * evaluation intentionally.
 */
export class RunTurnEvaluationUseCase {
    constructor(private readonly turnEvaluation: TurnEvaluationService) {}

    execute(input: RunTurnEvaluationUseCaseIn): Promise<RunTurnEvaluationUseCaseOut> {
        return this.turnEvaluation.evaluate(input);
    }
}
