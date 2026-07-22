export const CHAT_EXECUTION_EVENTS = Symbol("ChatExecutionEvents");

export interface ChatExecutionEventsPort {
    publish(executionId: string): void;
    subscribe(executionId: string, listener: () => void): () => void;
}
