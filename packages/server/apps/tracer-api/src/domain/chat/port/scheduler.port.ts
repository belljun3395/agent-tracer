export const CHAT_SCHEDULER = Symbol("ChatScheduler");

export interface ChatSchedulerPort {
    schedule(delayMs: number, callback: () => void): object;
    cancel(handle: object): void;
}
