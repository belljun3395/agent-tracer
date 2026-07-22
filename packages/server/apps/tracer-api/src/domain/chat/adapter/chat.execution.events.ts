import { Injectable } from "@nestjs/common";
import type { ChatExecutionEventsPort } from "~tracer-api/domain/chat/port/chat.execution.events.port.js";

@Injectable()
export class ChatExecutionEvents implements ChatExecutionEventsPort {
    private readonly listeners = new Map<string, Set<() => void>>();

    publish(executionId: string): void {
        for (const listener of this.listeners.get(executionId) ?? []) listener();
    }

    subscribe(executionId: string, listener: () => void): () => void {
        const listeners = this.listeners.get(executionId) ?? new Set<() => void>();
        listeners.add(listener);
        this.listeners.set(executionId, listeners);
        return () => {
            listeners.delete(listener);
            if (listeners.size === 0) this.listeners.delete(executionId);
        };
    }
}
