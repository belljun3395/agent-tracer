/** 명령 문자열이 기대 문자열 중 하나를 포함하는지 대소문자 구분 없이 판정한다. */
export function commandIncludesAny(command: string, needles: readonly string[]): boolean {
    const normalized = command.toLowerCase();
    return needles.some((needle) => normalized.includes(needle.toLowerCase()));
}

const patternCache = new Map<string, RegExp | null>();
const PATTERN_CACHE_MAX = 500;

/** 사용자 규칙 패턴을 안전하게 컴파일하고 잘못된 패턴은 null로 닫는다. */
export function compilePattern(pattern: string): RegExp | null {
    const cached = patternCache.get(pattern);
    if (cached !== undefined) return cached;
    let compiled: RegExp | null;
    try {
        compiled = new RegExp(pattern);
    } catch {
        compiled = null;
    }
    if (patternCache.size > PATTERN_CACHE_MAX) patternCache.clear();
    patternCache.set(pattern, compiled);
    return compiled;
}
