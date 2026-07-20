/** 색인 문서의 필드는 무엇이든 올 수 있으므로 빈 문자열은 값이 없는 것으로 읽는다. */
export function readString(value: unknown): string | undefined {
    return typeof value === "string" && value.length > 0 ? value : undefined;
}

export function readStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value.filter((entry): entry is string => typeof entry === "string");
}
