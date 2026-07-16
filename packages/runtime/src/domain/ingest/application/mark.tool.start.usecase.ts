import type {ClockPort} from "~runtime/domain/ingest/port/clock.port.js";
import type {ToolTimingPort} from "~runtime/domain/ingest/port/tool.timing.port.js";

/** PreToolUse가 도구 호출 시작 시각을 기록해 PostToolUse/PostToolUseFailure가 상관시키게 한다. */
export class MarkToolStartUsecase {
    constructor(
        private readonly timing: ToolTimingPort,
        private readonly clock: ClockPort,
    ) {}

    execute(sessionId: string, toolUseId: string): void {
        this.timing.markStart(sessionId, toolUseId, this.clock.now());
    }
}
