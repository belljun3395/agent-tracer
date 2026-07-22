import {
    condition,
    continueAsNew,
    defineSignal,
    isCancellation,
    proxyActivities,
    setHandler,
    startChild,
} from "@temporalio/workflow";
import type { ChatThreadWorkflowInput } from "~tracer-api/domain/chat/model/chat.workflow.spec.js";
import {
    CHAT_EXECUTION_ENQUEUE_SIGNAL,
    CHAT_EXECUTION_WORKFLOW,
} from "~tracer-api/domain/chat/model/chat.workflow.spec.js";

interface ChatQueueActivities {
    getNextChatExecution(threadId: string): Promise<string | null>;
}

const { getNextChatExecution } = proxyActivities<ChatQueueActivities>({
    startToCloseTimeout: "1 minute",
    retry: { maximumAttempts: 5 },
});

const enqueueExecution = defineSignal<[string]>(CHAT_EXECUTION_ENQUEUE_SIGNAL);

/** 스레드 안의 자식 실행을 ULID 순서로 하나씩 기다려 모델 호출이 겹치지 않게 한다. */
export async function chatThreadWorkflow(input: ChatThreadWorkflowInput): Promise<void> {
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
            const executionId = await getNextChatExecution(input.threadId);
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
                    await continueAsNew<typeof chatThreadWorkflow>(input);
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
