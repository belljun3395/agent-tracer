import type {EventLane, RuntimeIngestEventKind} from "~runtime/domain/ingest/model/event.model.js";
import {isRecord} from "~runtime/support/json.js";
import {toTrimmedString} from "~runtime/support/text.js";

const MAX_TOOL_INPUT_VALUE = 10_000;
const MAX_TOOL_INPUT_DEPTH = 4;

/** 어댑터가 와이어에서 읽어 도메인에 넘기는 도구 호출이다. */
export interface ToolCall {
    readonly toolName: string;
    readonly toolInput: Record<string, unknown>;
    readonly toolResponse?: unknown;
    readonly toolUseId?: string;
}

/** 도구 호출이 실패했을 때 어댑터가 함께 넘기는 실패 사실이다. */
export interface ToolFailure extends ToolCall {
    readonly error: string;
    readonly isInterrupt: boolean;
}

/** 조형에 필요한 워크스페이스 문맥이다. */
export interface ToolShapeContext {
    readonly projectDir: string;
}

/** 도구 호출 하나를 원장 이벤트로 조형한 결과다. */
export interface ShapedToolEvent {
    readonly kind: RuntimeIngestEventKind;
    readonly lane: EventLane;
    readonly title: string;
    readonly body?: string;
    readonly filePaths?: readonly string[];
    readonly toolName?: string;
    readonly command?: string;
    readonly metadata: object;
}

export function toolUseIdOf(call: ToolCall): {readonly toolUseId?: string} {
    return call.toolUseId ? {toolUseId: call.toolUseId} : {};
}

/** 로그와 원장에 남기기 안전하도록 도구 입력을 재귀적으로 정제한다. */
export function sanitizeToolInput(
    input: Record<string, unknown>,
    maxValueLength: number = MAX_TOOL_INPUT_VALUE,
): Record<string, unknown> {
    return Object.fromEntries(
        Object.entries(input).map(([key, value]) => [key, sanitizeValue(value, maxValueLength, 0)]),
    );
}

function sanitizeValue(value: unknown, maxValueLength: number, depth: number): unknown {
    if (value === null || value === undefined) return value;
    if (typeof value === "string") return toTrimmedString(value, maxValueLength);
    if (typeof value === "number" || typeof value === "boolean") return value;
    if (typeof value === "bigint") return value.toString();
    if (depth >= MAX_TOOL_INPUT_DEPTH) return "[max-depth]";
    if (Array.isArray(value)) {
        return value.map((entry) => sanitizeValue(entry, maxValueLength, depth + 1));
    }
    if (isRecord(value)) {
        return Object.fromEntries(
            Object.entries(value).map(([key, nested]) => [key, sanitizeValue(nested, maxValueLength, depth + 1)]),
        );
    }
    return toTrimmedString(Object.prototype.toString.call(value), maxValueLength);
}
