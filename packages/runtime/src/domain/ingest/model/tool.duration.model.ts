import type {ShapedToolEvent} from "~runtime/domain/ingest/model/tool.call.model.js";

/** takeStart는 시작 시각을 읽으며 지운다. */
export interface ToolDurationInput {
    readonly toolUseId?: string;
    readonly sessionId: string;
    readonly takeStart: (sessionId: string, toolUseId: string) => number | undefined;
    readonly now: number;
}

/** PreToolUse가 남긴 시작 시각을 소거하며 읽어 소요 시간을 계산하고, 유한한 음이 아닌 값일 때만 싣는다. */
export function withToolDuration(shaped: ShapedToolEvent, input: ToolDurationInput): ShapedToolEvent {
    if (!input.toolUseId) return shaped;
    const startedAt = input.takeStart(input.sessionId, input.toolUseId);
    if (startedAt === undefined) return shaped;
    const durationMs = input.now - startedAt;
    if (!Number.isFinite(durationMs) || durationMs < 0) return shaped;
    return {...shaped, metadata: {...shaped.metadata, durationMs}};
}
