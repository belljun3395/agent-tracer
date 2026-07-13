import { isCancellation, proxyActivities } from "@temporalio/workflow";
import { messageOf } from "~ai-agent-worker/support/failure.message.js";
import { AI_GENERATE_QUEUE } from "~ai-agent-worker/support/task.queue.const.js";
import type {
    FailCleanupJobInput,
    TaskCleanupFinalizeInput,
    TaskCleanupGenerateOutput,
    TaskCleanupInput,
    TaskCleanupPrep,
} from "~ai-agent-worker/domain/cleanup/model/cleanup.job.model.js";

interface CleanupPrepareActivities {
    prepareTaskCleanup(input: TaskCleanupInput): Promise<TaskCleanupPrep>;
}

interface CleanupGenerateActivities {
    generateTaskCleanupSuggestions(prep: TaskCleanupPrep): Promise<TaskCleanupGenerateOutput>;
}

interface CleanupFinalizeActivities {
    finalizeTaskCleanup(input: TaskCleanupFinalizeInput): Promise<void>;
    markCleanupJobFailed(input: FailCleanupJobInput): Promise<void>;
}

const { prepareTaskCleanup } = proxyActivities<CleanupPrepareActivities>({
    startToCloseTimeout: "2 minutes",
    retry: { maximumAttempts: 5 },
});

const { generateTaskCleanupSuggestions } = proxyActivities<CleanupGenerateActivities>({
    taskQueue: AI_GENERATE_QUEUE,
    startToCloseTimeout: "10 minutes",
    scheduleToCloseTimeout: "30 minutes",
    heartbeatTimeout: "30 seconds",
    retry: { maximumAttempts: 3, initialInterval: "10 seconds" },
});

const { finalizeTaskCleanup, markCleanupJobFailed } = proxyActivities<CleanupFinalizeActivities>({
    startToCloseTimeout: "1 minute",
    retry: { maximumAttempts: 5 },
});

/** 태스크 정리 제안 잡을 실행한다. */
export async function taskCleanupWorkflow(input: TaskCleanupInput): Promise<void> {
    try {
        const prep = await prepareTaskCleanup(input);
        const output = prep.candidates.length === 0 ? null : await generateTaskCleanupSuggestions(prep);
        await finalizeTaskCleanup({
            jobId: prep.jobId,
            userId: prep.userId,
            tasksScanned: prep.tasksScanned,
            output,
        });
    } catch (err) {
        if (isCancellation(err)) throw err;
        await markCleanupJobFailed({ jobId: input.jobId, message: messageOf(err) });
        throw err;
    }
}
