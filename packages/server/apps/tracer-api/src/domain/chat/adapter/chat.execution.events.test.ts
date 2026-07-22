import { describe, expect, it, vi } from "vitest";
import { ChatExecutionEvents } from "./chat.execution.events.js";

describe("ChatExecutionEvents", () => {
    it("실행별 구독자에게만 알리고 해제 뒤에는 보내지 않는다", () => {
        const events = new ChatExecutionEvents();
        const listener = vi.fn();
        const unsubscribe = events.subscribe("execution-1", listener);

        events.publish("execution-2");
        events.publish("execution-1");
        unsubscribe();
        events.publish("execution-1");

        expect(listener).toHaveBeenCalledOnce();
    });
});
