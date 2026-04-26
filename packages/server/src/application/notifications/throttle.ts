export interface ThrottleResult {
    readonly admit: boolean;
    readonly suppressedSince: number;
    readonly suppressedCount: number;
}

export interface SlidingWindowThrottle {
    admit(nowMs: number): ThrottleResult;
}

export function makeSlidingWindowThrottle(opts: { readonly windowMs: number }): SlidingWindowThrottle {
    let lastAdmittedAt: number | null = null;
    let suppressed = 0;
    return {
        admit(nowMs: number): ThrottleResult {
            if (lastAdmittedAt === null || nowMs - lastAdmittedAt >= opts.windowMs) {
                const result = {
                    admit: true,
                    suppressedSince: lastAdmittedAt ?? nowMs,
                    suppressedCount: suppressed,
                };
                lastAdmittedAt = nowMs;
                suppressed = 0;
                return result;
            }
            suppressed += 1;
            return {
                admit: false,
                suppressedSince: lastAdmittedAt,
                suppressedCount: suppressed,
            };
        },
    };
}
