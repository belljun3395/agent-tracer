import { isCancellation, proxyActivities } from "@temporalio/workflow";
import { messageOf } from "~ai-agent-worker/support/failure.message.js";
import { AI_GENERATE_QUEUE } from "~ai-agent-worker/support/task.queue.const.js";
import type {
    FailRecipeJobInput,
    RecipeScanFinalizeInput,
    RecipeScanGenerateOutput,
    RecipeScanInput,
    RecipeScanPrep,
} from "~ai-agent-worker/domain/recipe/model/recipe.job.model.js";

interface RecipePrepareActivities {
    prepareRecipeScan(input: RecipeScanInput): Promise<RecipeScanPrep>;
}

interface RecipeGenerateActivities {
    generateRecipeCandidates(prep: RecipeScanPrep): Promise<RecipeScanGenerateOutput>;
}

interface RecipeFinalizeActivities {
    finalizeRecipeScan(input: RecipeScanFinalizeInput): Promise<void>;
    markRecipeJobFailed(input: FailRecipeJobInput): Promise<void>;
}

const { prepareRecipeScan } = proxyActivities<RecipePrepareActivities>({
    startToCloseTimeout: "1 minute",
    retry: { maximumAttempts: 5 },
});

const { generateRecipeCandidates } = proxyActivities<RecipeGenerateActivities>({
    taskQueue: AI_GENERATE_QUEUE,
    startToCloseTimeout: "15 minutes",
    scheduleToCloseTimeout: "1 hour",
    heartbeatTimeout: "30 seconds",
    retry: { maximumAttempts: 3, initialInterval: "10 seconds" },
});

const { finalizeRecipeScan, markRecipeJobFailed } = proxyActivities<RecipeFinalizeActivities>({
    startToCloseTimeout: "1 minute",
    retry: { maximumAttempts: 5 },
});

/** 레시피 후보 생성 잡을 실행한다. */
export async function recipeScanWorkflow(input: RecipeScanInput): Promise<void> {
    try {
        const prep = await prepareRecipeScan(input);
        const output = await generateRecipeCandidates(prep);
        await finalizeRecipeScan({
            jobId: prep.jobId,
            userId: prep.userId,
            sourceTaskId: prep.taskId,
            language: prep.language,
            output,
        });
    } catch (err) {
        if (isCancellation(err)) throw err;
        await markRecipeJobFailed({ jobId: input.jobId, message: messageOf(err) });
        throw err;
    }
}
