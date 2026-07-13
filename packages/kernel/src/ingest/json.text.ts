export const LONE_SURROGATE_REASON = "payload contains a lone UTF-16 surrogate";
export const NULL_CHARACTER_REASON = "payload contains a NUL character";

function scanText(text: string): string | null {
    for (let index = 0; index < text.length; index += 1) {
        const code = text.charCodeAt(index);
        if (code === 0) return NULL_CHARACTER_REASON;
        if (code >= 0xd800 && code <= 0xdbff) {
            const next = text.charCodeAt(index + 1);
            if (!(next >= 0xdc00 && next <= 0xdfff)) return LONE_SURROGATE_REASON;
            index += 1;
        } else if (code >= 0xdc00 && code <= 0xdfff) {
            return LONE_SURROGATE_REASON;
        }
    }
    return null;
}

/** Postgres json/jsonb가 거부하는 문자(짝 잃은 서로게이트·U+0000)를 키와 값에서 찾아 사유를 돌려준다. */
export function findJsonTextViolation(value: unknown): string | null {
    if (typeof value === "string") return scanText(value);
    if (Array.isArray(value)) {
        for (const item of value) {
            const reason = findJsonTextViolation(item);
            if (reason !== null) return reason;
        }
        return null;
    }
    if (typeof value === "object" && value !== null) {
        for (const [key, item] of Object.entries(value)) {
            const keyReason = scanText(key);
            if (keyReason !== null) return keyReason;
            const reason = findJsonTextViolation(item);
            if (reason !== null) return reason;
        }
    }
    return null;
}
