const compiledPatternCache = new Map<string, RegExp | null>();
const CACHE_MAX = 500;

export function compilePattern(pattern: string): RegExp | null {
    const cached = compiledPatternCache.get(pattern);
    if (cached !== undefined) return cached;
    let compiled: RegExp | null;
    try {
        compiled = new RegExp(pattern);
    } catch {
        compiled = null;
    }
    if (compiledPatternCache.size > CACHE_MAX) compiledPatternCache.clear();
    compiledPatternCache.set(pattern, compiled);
    return compiled;
}
