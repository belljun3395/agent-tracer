const RULE_GEN_LOG_PREFIX = "[rule-gen]";

/** 규칙 생성 로그 줄의 접두사와 개행을 소유하며 실제로 쓰는 것은 호출부의 몫이다. */
export function ruleGenLogLine(message: string): string {
    return `${RULE_GEN_LOG_PREFIX} ${message}\n`;
}
