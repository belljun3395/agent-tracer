import type { AgentQueryUsage } from "./agent.usage.js";

// 백만 토큰당 USD이며 이름 부분일치로 버전 접미사가 붙은 모델도 해석한다.
interface ModelRate {
    readonly input: number;
    readonly output: number;
    readonly cacheWrite: number;
    readonly cacheRead: number;
}

const MODEL_RATES: ReadonlyArray<readonly [string, ModelRate]> = [
    ["sonnet", { input: 3.0, output: 15.0, cacheWrite: 3.75, cacheRead: 0.3 }],
    ["haiku", { input: 1.0, output: 5.0, cacheWrite: 1.25, cacheRead: 0.1 }],
];

function rateFor(model: string): ModelRate | null {
    const lowered = model.toLowerCase();
    for (const [key, rate] of MODEL_RATES) {
        if (lowered.includes(key)) return rate;
    }
    return null;
}

/** 단가를 모르는 모델은 예산을 집행할 수 없으므로 집행 가능 여부를 먼저 묻는다. */
export function canEstimateCost(model: string): boolean {
    return rateFor(model) !== null;
}

/** 모델이나 사용량을 모르면 오도하지 않도록 null을 낸다. */
export function estimateCostUsd(model: string, usage: AgentQueryUsage | null): number | null {
    const rate = rateFor(model);
    if (rate === null || usage === null) return null;
    const cost =
        (usage.inputTokens * rate.input
            + usage.outputTokens * rate.output
            + usage.cacheCreationTokens * rate.cacheWrite
            + usage.cacheReadTokens * rate.cacheRead)
        / 1_000_000;
    return Math.round(cost * 1_000_000) / 1_000_000;
}
