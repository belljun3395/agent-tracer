import { Injectable } from "@nestjs/common";
import type { ChatSchedulerPort } from "~tracer-api/domain/chat/port/scheduler.port.js";

@Injectable()
export class ChatScheduler implements ChatSchedulerPort {
    schedule(delayMs: number, callback: () => void): ReturnType<typeof setTimeout> {
        return setTimeout(callback, delayMs);
    }

    cancel(handle: object): void {
        clearTimeout(handle as ReturnType<typeof setTimeout>);
    }
}
