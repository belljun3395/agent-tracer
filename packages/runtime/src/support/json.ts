/** 런타임 경계를 넘어오는 JSON 객체다. */
export type JsonObject = Record<string, unknown>;

/** 배열과 null을 제외한 객체만 레코드로 판별한다. */
export function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
