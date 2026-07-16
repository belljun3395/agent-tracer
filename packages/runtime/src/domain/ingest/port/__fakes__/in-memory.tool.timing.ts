import type {ToolTimingPort} from "~runtime/domain/ingest/port/tool.timing.port.js";

export class InMemoryToolTiming implements ToolTimingPort {
    private readonly starts = new Map<string, number>();

    markStart(sessionId: string, toolUseId: string, startedAtMs: number): void {
        this.starts.set(`${sessionId}:${toolUseId}`, startedAtMs);
    }

    takeStart(sessionId: string, toolUseId: string): number | undefined {
        const key = `${sessionId}:${toolUseId}`;
        const value = this.starts.get(key);
        this.starts.delete(key);
        return value;
    }
}
