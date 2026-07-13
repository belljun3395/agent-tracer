import {isRecord} from "~runtime/support/json.js";

export const HOOK_STDIN_MAX_BYTES = 5 * 1024 * 1024;

/** 상한까지 읽은 stdin을 JSON 객체로 파싱하고 비었으면 빈 객체를 낸다. */
export async function readStdinJson(): Promise<Record<string, unknown>> {
    let raw = "";
    let bytes = 0;
    for await (const chunk of process.stdin) {
        const text = String(chunk);
        bytes += Buffer.byteLength(text, "utf8");
        if (bytes > HOOK_STDIN_MAX_BYTES) throw new Error(`hook stdin exceeds ${HOOK_STDIN_MAX_BYTES} bytes`);
        raw += text;
    }
    if (!raw.trim()) return {};
    const parsed = JSON.parse(raw) as unknown;
    return isRecord(parsed) ? parsed : {};
}
