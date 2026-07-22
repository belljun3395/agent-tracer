import {
    condition,
    continueAsNew,
    defineSignal,
    isCancellation,
    proxyActivities,
    setHandler,
    startChild,
} from "@temporalio/workflow";
import type {
    ChatExecutionWorkflowInput,
    FailChatExecutionInput,
    ChatThreadWorkflowInput,
} from "~tracer-api/domain/chat/model/chat.workflow.spec.js";
import {
    CHAT_EXECUTION_ENQUEUE_SIGNAL,
    CHAT_EXECUTION_WORKFLOW,
} from "~tracer-api/domain/chat/model/chat.workflow.spec.js";

interface ChatExecutionActivities {
    executeChatExecution(input: ChatExecutionWorkflowInput): Promise<void>;
    failChatExecution(input: FailChatExecutionInput): Promise<void>;
}

interface ChatQueueActivities {
    getNextChatExecution(threadId: string): Promise<string | null>;
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

const { getNextChatExecution } = proxyActivities<ChatQueueActivities>({
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

const enqueueExecution = defineSignal<[string]>(CHAT_EXECUTION_ENQUEUE_SIGNAL);

/** 스레드 안의 자식 실행을 ULID 순서로 하나씩 기다려 모델 호출이 겹치지 않게 한다. */
export async function chatThreadWorkflow(_input: ChatThreadWorkflowInput): Promise<void> {
    let wake = false;
    let completedChildren = 0;
    setHandler(enqueueExecution, () => {
        wake = true;
    });
    for (;;) {
        const signaled = await condition(() => wake, "5 seconds");
        if (!signaled) return;
        wake = false;
        for (;;) {
            const executionId = await getNextChatExecution(_input.threadId);
            if (executionId === null) break;
            try {
                const child = await startChild(CHAT_EXECUTION_WORKFLOW, {
                    workflowId: executionWorkflowId(executionId),
                    workflowIdReusePolicy: "REJECT_DUPLICATE",
                    args: [{ executionId }],
                });
                await child.result();
                completedChildren += 1;
                if (completedChildren >= 100) {
                    await continueAsNew<typeof chatThreadWorkflow>(_input);
                }
            } catch (error) {
                if (!isCancellation(error)) continue;
            }
        }
    }
}

function executionWorkflowId(executionId: string): string {
    return `chat:${executionId}`;
}

function messageOf(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}
