import {
    isCancellation,
    proxyActivities,
} from "@temporalio/workflow";
import type {
    ChatExecutionWorkflowInput,
    FailChatExecutionInput,
} from "~tracer-api/domain/chat/model/chat.workflow.spec.js";

interface ChatExecutionActivities {
    executeChatExecution(input: ChatExecutionWorkflowInput): Promise<void>;
    failChatExecution(input: FailChatExecutionInput): Promise<void>;
}

const { executeChatExecution } = proxyActivities<ChatExecutionActivities>({
    startToCloseTimeout: "15 minutes",
    heartbeatTimeout: "30 seconds",
    retry: { maximumAttempts: 3, initialInterval: "10 seconds" },
});

const { failChatExecution } = proxyActivities<ChatExecutionActivities>({
    startToCloseTimeout: "1 minute",
    retry: { maximumAttempts: 5 },
});

/** 브라우저와 API 연결 밖에서 대화 실행 하나를 소유하고 실패 상태를 끝까지 기록한다. */
export async function chatExecutionWorkflow(input: ChatExecutionWorkflowInput): Promise<void> {
    try {
        await executeChatExecution(input);
    } catch (error) {
        if (isCancellation(error)) throw error;
        await failChatExecution({ executionId: input.executionId, error: messageOf(error) });
        throw error;
    }
}

function messageOf(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}
