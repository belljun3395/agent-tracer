import { isCancellation, proxyActivities } from "@temporalio/workflow";
import { messageOf } from "~ai-agent-worker/support/failure.message.js";
import { AI_GENERATE_QUEUE } from "~ai-agent-worker/support/task.queue.const.js";
import type {
    FailTitleJobInput,
    TitleSuggestionFinalizeInput,
    TitleSuggestionGenerateOutput,
    TitleSuggestionInput,
    TitleSuggestionPrep,
} from "~ai-agent-worker/domain/title/model/title.job.model.js";

interface TitlePrepareActivities {
    prepareTitleSuggestion(input: TitleSuggestionInput): Promise<TitleSuggestionPrep>;
}

interface TitleGenerateActivities {
    generateTitleSuggestion(prep: TitleSuggestionPrep): Promise<TitleSuggestionGenerateOutput>;
}

interface TitleFinalizeActivities {
    finalizeTitleSuggestion(input: TitleSuggestionFinalizeInput): Promise<void>;
    markTitleJobFailed(input: FailTitleJobInput): Promise<void>;
}

const { prepareTitleSuggestion } = proxyActivities<TitlePrepareActivities>({
    startToCloseTimeout: "1 minute",
    retry: { maximumAttempts: 5 },
});

const { generateTitleSuggestion } = proxyActivities<TitleGenerateActivities>({
    taskQueue: AI_GENERATE_QUEUE,
    startToCloseTimeout: "5 minutes",
    scheduleToCloseTimeout: "20 minutes",
    heartbeatTimeout: "30 seconds",
    retry: { maximumAttempts: 3, initialInterval: "10 seconds" },
});

const { finalizeTitleSuggestion, markTitleJobFailed } = proxyActivities<TitleFinalizeActivities>({
    startToCloseTimeout: "1 minute",
    retry: { maximumAttempts: 5 },
});

/** 제목 제안 잡을 실행한다. */
export async function titleSuggestionWorkflow(input: TitleSuggestionInput): Promise<void> {
    try {
        const prep = await prepareTitleSuggestion(input);
        const output = await generateTitleSuggestion(prep);
        await finalizeTitleSuggestion({ jobId: prep.jobId, userId: prep.userId, output });
    } catch (err) {
        if (isCancellation(err)) throw err;
        await markTitleJobFailed({ jobId: input.jobId, message: messageOf(err) });
        throw err;
    }
}
