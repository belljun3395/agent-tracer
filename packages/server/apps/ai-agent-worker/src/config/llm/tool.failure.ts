/** 도구 실패를 모델이 다음 행동을 정할 수 있는 문장으로 바꾼다. */
export function toolFailureText(name: string, err: unknown): string {
    const reason = err instanceof Error ? err.message : String(err);
    return `Tool ${name} failed: ${reason}. Do not call it again more than once. `
        + `Continue with the evidence you already have, and state in your rationale which evidence you could not check.`;
}

export function unknownToolText(name: string, available: readonly string[]): string {
    return `Tool ${name} is not available. Available tools: ${available.join(", ")}.`;
}
