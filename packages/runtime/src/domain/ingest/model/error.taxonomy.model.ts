export const TOOL_ERROR_TYPES = [
    "interrupt",
    "permission",
    "timeout",
    "not_found",
    "invalid_input",
    "network",
    "unknown",
] as const;

export type ToolErrorType = (typeof TOOL_ERROR_TYPES)[number];

interface ErrorRule {
    readonly pattern: RegExp;
    readonly type: ToolErrorType;
}

// 위에서부터 첫 매치로 판정하므로 넓은 패턴(not_found)을 좁은 패턴(invalid_input)보다 앞에 둔다.
const ERROR_RULES: readonly ErrorRule[] = [
    {pattern: /permission denied|not allowed|EACCES|EPERM|denied by (the )?user/i, type: "permission"},
    {pattern: /timed? ?out|ETIMEDOUT|deadline exceeded/i, type: "timeout"},
    {pattern: /no such file|command not found|not found|ENOENT|does not exist/i, type: "not_found"},
    {pattern: /ECONNREFUSED|ECONNRESET|ENOTFOUND|EAI_AGAIN|socket hang up|fetch failed|network/i, type: "network"},
    {pattern: /InputValidationError|invalid|must be|required (parameter|field)|\bexpected\b/i, type: "invalid_input"},
];

/** 실패한 도구 호출의 에러 문자열을 선언적 규칙 테이블로 첫 매치 판정한다. */
export function classifyToolError(error: string, isInterrupt: boolean): ToolErrorType {
    if (isInterrupt) return "interrupt";
    return ERROR_RULES.find((rule) => rule.pattern.test(error))?.type ?? "unknown";
}
