/** 이벤트를 생산한 에이전트 런타임이며 GenAI 공급자 유도의 단일 근거다. */
export const RUNTIME_SOURCE = {
    claudePlugin: "claude-plugin",
    claudeCode: "claude-code",
} as const;

export type RuntimeSource = (typeof RUNTIME_SOURCE)[keyof typeof RUNTIME_SOURCE];

const RUNTIME_SOURCE_SET = new Set<string>(Object.values(RUNTIME_SOURCE));

export function isRuntimeSource(value: string | undefined): value is RuntimeSource {
    return value !== undefined && RUNTIME_SOURCE_SET.has(value);
}

export function isClaudeRuntimeSource(value: string | undefined): boolean {
    return value === RUNTIME_SOURCE.claudePlugin || value === RUNTIME_SOURCE.claudeCode;
}
