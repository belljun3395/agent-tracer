/** 자유형 속성 가방에서 비어 있지 않은 문자열을 읽는다. */
export function readString(source: Record<string, unknown>, key: string): string | undefined {
    const value = source[key];
    return typeof value === "string" && value.length > 0 ? value : undefined;
}
