/** 실행기가 보고한 비용 지표다. */
export interface JobRunCost {
    readonly usage?: Record<string, unknown> | undefined;
    readonly modelUsed?: string | null | undefined;
    readonly durationMs?: number | null | undefined;
    readonly costUsd?: number | null | undefined;
    readonly numTurns?: number | null | undefined;
}

/** 실행기가 보고한 비용 지표를 잡 사용량 한 덩어리로 접으며 아무것도 없으면 싣지 않는다. */
export function buildJobUsage(body: JobRunCost): Record<string, unknown> | undefined {
    const usage = { ...(body.usage ?? {}) };
    if (body.modelUsed !== undefined && body.modelUsed !== null) usage["model"] = body.modelUsed;
    if (body.durationMs !== undefined && body.durationMs !== null) usage["durationMs"] = body.durationMs;
    if (body.costUsd !== undefined) usage["costUsd"] = body.costUsd;
    if (body.numTurns !== undefined) usage["numTurns"] = body.numTurns;
    return Object.keys(usage).length > 0 ? usage : undefined;
}
