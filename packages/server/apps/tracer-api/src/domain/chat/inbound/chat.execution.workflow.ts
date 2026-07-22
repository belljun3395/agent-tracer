import {
    isCancellation,
    proxyActivities,
} from "@temporalio/workflow";
import type {
    ChatExecutionWorkflowInput,
    FailChatExecutionInput,
} from "~tracer-api/domain/chat/model/chat.workflow.spec.js";
import type { GeneratedChatExecution, PreparedChatExecution } from "~tracer-api/domain/chat/model/chat.execution.stage.js";

interface ChatExecutionActivities {
    prepareChatExecution(input: ChatExecutionWorkflowInput): Promise<PreparedChatExecution>;
    generateChatExecution(input: PreparedChatExecution): Promise<GeneratedChatExecution>;
    finalizeChatExecution(input: GeneratedChatExecution): Promise<void>;
    failChatExecution(input: FailChatExecutionInput): Promise<void>;
}

const { prepareChatExecution, finalizeChatExecution } = proxyActivities<ChatExecutionActivities>({
    startToCloseTimeout: "2 minutes",
    retry: { maximumAttempts: 5 },
});

const { generateChatExecution } = proxyActivities<ChatExecutionActivities>({
    startToCloseTimeout: "15 minutes",
    heartbeatTimeout: "30 seconds",
    retry: { maximumAttempts: 1 },
});

const { failChatExecution } = proxyActivities<ChatExecutionActivities>({
    startToCloseTimeout: "1 minute",
    retry: { maximumAttempts: 5 },
});

/** 브라우저와 API 연결 밖에서 대화 실행 하나를 소유하고 실패 상태를 끝까지 기록한다. */
export async function chatExecutionWorkflow(input: ChatExecutionWorkflowInput): Promise<void> {
    try {
        const prepared = await prepareChatExecution(input);
        const generated = await generateChatExecution(prepared);
        await finalizeChatExecution(generated);
    } catch (error) {
        if (isCancellation(error)) throw error;
        await failChatExecution({ executionId: input.executionId, error: messageOf(error) });
        throw error;
    }
}

function messageOf(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}
