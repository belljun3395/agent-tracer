/** UTF-16 문자 경계를 보존하면서 문자열을 최대 길이로 제한한다. */
export function truncate(value: string, maxLength: number): string {
    if (maxLength <= 0) return "";
    if (value.length <= maxLength) return value;
    const cut = value.slice(0, maxLength);
    return isHighSurrogate(cut.charCodeAt(cut.length - 1)) ? cut.slice(0, -1) : cut;
}

function truncateStart(value: string, maxLength: number): string {
    if (maxLength <= 0) return "";
    if (value.length <= maxLength) return value;
    const cut = value.slice(value.length - maxLength);
    return isLowSurrogate(cut.charCodeAt(0)) ? cut.slice(1) : cut;
}

function isHighSurrogate(code: number): boolean {
    return code >= 0xd800 && code <= 0xdbff;
}

function isLowSurrogate(code: number): boolean {
    return code >= 0xdc00 && code <= 0xdfff;
}

/** 원시 값을 공백이 제거된 제한 길이 문자열로 정규화한다. */
export function toTrimmedString(value: unknown, maxLength?: number): string {
    const next = typeof value === "string"
        ? value.trim()
        : (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint")
            ? String(value).trim()
            : "";
    if (!maxLength || next.length <= maxLength) return next;
    return truncate(next, maxLength);
}

/** 제한 길이를 넘는 문자열에 말줄임표를 붙인다. */
export function ellipsize(value: string, maxLength: number): string {
    if (value.length <= maxLength) return value;
    if (maxLength <= 1) return truncate(value, maxLength);
    return `${truncate(value, maxLength - 1)}…`;
}

/** 잘린 본문과 자르기 전 전체 바이트 수다. */
export interface TruncatedOutput {
    readonly body: string;
    readonly bytes: number;
    readonly truncated: boolean;
}

/** 긴 도구 출력의 앞뒤 문맥과 원본 바이트 수를 보존한다. */
export function truncateOutput(text: string, headChars: number, tailChars: number): TruncatedOutput {
    const bytes = Buffer.byteLength(text, "utf8");
    if (text.length <= headChars + tailChars) {
        return {body: text, bytes, truncated: false};
    }
    const head = truncate(text, headChars);
    const tail = truncateStart(text, tailChars);
    const omitted = text.length - head.length - tail.length;
    return {body: `${head}\n…[${omitted} chars omitted]…\n${tail}`, bytes, truncated: true};
}

/** 도구 입력의 참과 거짓 표현을 불리언으로 정규화한다. */
export function toBoolean(value: unknown): boolean {
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value !== 0;
    const normalized = toTrimmedString(value).toLowerCase();
    return normalized === "true" || normalized === "1" || normalized === "yes";
}
