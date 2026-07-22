export const CHAT_EXECUTION_TASK_QUEUE = "chat-executions";
export const CHAT_EXECUTION_WORKFLOW = "chatExecutionWorkflow";
export const CHAT_THREAD_WORKFLOW = "chatThreadWorkflow";
export const CHAT_EXECUTION_ENQUEUE_SIGNAL = "enqueueChatExecution";

export interface ChatThreadWorkflowInput {
    readonly threadId: string;
}

export interface ChatExecutionWorkflowInput {
    readonly executionId: string;
}

export interface FailChatExecutionInput extends ChatExecutionWorkflowInput {
    readonly error: string;
}
