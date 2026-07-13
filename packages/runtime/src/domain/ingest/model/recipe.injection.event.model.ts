import {KIND} from "~runtime/domain/ingest/model/event.model.js";
import type {IngestTarget} from "~runtime/domain/ingest/model/event.model.js";
import type {RunEventInput} from "~runtime/domain/ingest/model/ingest.event.model.js";

/** 프롬프트 앞에 레시피 한 건이 주입된 사실이며 applicationId가 그 주입의 식별자다. */
export interface RecipeInjectionInput {
    readonly recipeId: string;
    readonly applicationId: string;
    readonly score: number;
    readonly injectedVia: string;
}

export function recipeInjectedEvent(
    target: IngestTarget,
    input: RecipeInjectionInput,
): RunEventInput {
    return {
        kind: KIND.recipeInjected,
        taskId: target.taskId,
        sessionId: target.sessionId,
        ...(target.turnId ? {turnId: target.turnId} : {}),
        payload: {
            recipeId: input.recipeId,
            applicationId: input.applicationId,
            injectedVia: input.injectedVia,
            score: input.score,
        },
    };
}
