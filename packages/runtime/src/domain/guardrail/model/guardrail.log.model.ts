const GUARDRAIL_LOG_PREFIX = "[guardrail]";

/** 가드레일 로그 줄의 접두사와 개행을 소유하며 실제로 쓰는 것은 호출부의 몫이다. */
export function guardrailLogLine(message: string): string {
    return `${GUARDRAIL_LOG_PREFIX} ${message}\n`;
}
