import {
    KIND,
    TERMINAL_COMMAND_TOOL_NAME,
    isTerminalCommand,
    toolNameOf,
} from "~kernel/ingest/event.kind.const.js";
import { AGENT_TRACER_ATTR, SEMCONV_ATTR } from "~kernel/observability/semconv.const.js";
import { canonicalizeToolName, normalizeRuleExpectedAction } from "./rule.tool-alias.const.js";
import {
    RULE_EXPECTED_ACTION,
    type RuleTriggerSource,
    type ToolCall,
} from "../definition/rule.vocabulary.js";

/** 규칙 판정에 필요한 이벤트의 최소 입력 계약이다. */
export interface RuleEvaluationEvent {
    readonly kind: string;
    readonly toolName?: string | null;
    readonly filePaths?: readonly string[];
    readonly metadata: Record<string, unknown>;
}

function readMetaString(metadata: Record<string, unknown>, key: string): string | undefined {
    const value = metadata[key];
    return typeof value === "string" && value.trim() ? value : undefined;
}

function readStringArrayValue(value: unknown): readonly string[] {
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function readToolInputString(metadata: Record<string, unknown>, key: string): string | undefined {
    const toolInput = metadata["toolInput"];
    if (toolInput === null || typeof toolInput !== "object" || Array.isArray(toolInput)) return undefined;
    const value = (toolInput as Record<string, unknown>)[key];
    return typeof value === "string" && value.trim() ? value : undefined;
}

function normalizeToken(value: string | undefined): string {
    return (value ?? "").toLowerCase().replace(/[\s._-]+/g, "");
}

function inferSemanticTool(metadata: Record<string, unknown>): string | null {
    const subtypeKey = normalizeToken(readMetaString(metadata, AGENT_TRACER_ATTR.subtypeKey));
    if (subtypeKey) {
        if (["runcommand", "runtest", "runbuild", "runlint", "verify", "shellprobe"].includes(subtypeKey)) return "command";
        if (["readfile", "grepcode", "globfiles", "listfiles"].includes(subtypeKey)) return "file-read";
        if (["modifyfile", "createfile", "deletefile", "renamefile", "applypatch"].includes(subtypeKey)) return "file-write";
        if (subtypeKey === "websearch" || subtypeKey === "webfetch") return "web";
    }
    const toolFamily = normalizeToken(readMetaString(metadata, AGENT_TRACER_ATTR.toolFamily));
    const operation = normalizeToken(readMetaString(metadata, AGENT_TRACER_ATTR.operation));
    if (toolFamily === "terminal") return "command";
    if (toolFamily === "file") return operation === "observe" || operation === "read" ? "file-read" : "file-write";
    if (toolFamily === "explore") {
        const entityType = normalizeToken(readMetaString(metadata, AGENT_TRACER_ATTR.entityType));
        if (entityType === "file") return "file-read";
        if (entityType === "url" || entityType === "query") return "web";
    }
    if (toolFamily === "web") return "web";
    return null;
}

function firstNonEmpty(...values: readonly (string | undefined)[]): string | undefined {
    return values.find((value) => value !== undefined && value.trim().length > 0);
}

function readFilePath(event: RuleEvaluationEvent): string | undefined {
    const metadata = event.metadata;
    const metadataFilePaths = readStringArrayValue(metadata[AGENT_TRACER_ATTR.filePaths]);
    return firstNonEmpty(
        metadataFilePaths[0],
        readMetaString(metadata, "filePath"),
        event.filePaths?.find((value) => value.trim().length > 0),
        readMetaString(metadata, AGENT_TRACER_ATTR.entityType) === "file"
            ? readMetaString(metadata, AGENT_TRACER_ATTR.entityName)
            : undefined,
        readToolInputString(metadata, "file_path"),
        readMetaString(metadata, "searchPath"),
    );
}

function readTarget(event: RuleEvaluationEvent): string | undefined {
    const metadata = event.metadata;
    const webUrls = readStringArrayValue(metadata["webUrls"]);
    return firstNonEmpty(
        webUrls[0],
        readMetaString(metadata, "webQuery"),
        readMetaString(metadata, AGENT_TRACER_ATTR.entityName),
        readToolInputString(metadata, "url"),
        readToolInputString(metadata, "query"),
    );
}

function buildToolCall(tool: string, event: RuleEvaluationEvent): ToolCall {
    const metadata = event.metadata;
    const canonicalTool = canonicalizeToolName(tool);
    const command = readMetaString(metadata, AGENT_TRACER_ATTR.command);
    const filePath = readFilePath(event);
    const target = normalizeRuleExpectedAction(canonicalTool) === RULE_EXPECTED_ACTION.web
        ? readTarget(event)
        : undefined;
    return {
        tool: canonicalTool,
        ...(command !== undefined ? { command } : {}),
        ...(filePath !== undefined ? { filePath } : {}),
        ...(target !== undefined ? { target } : {}),
    };
}

/** 이벤트 메타데이터를 정규화한 도구 호출 증거를 반환한다. */
export function inferToolCall(event: RuleEvaluationEvent): ToolCall | null {
    const toolName = readMetaString(event.metadata, SEMCONV_ATTR.toolName)
        ?? readMetaString(event.metadata, AGENT_TRACER_ATTR.sourceTool)
        ?? toolNameOf(event);
    if (toolName) return buildToolCall(toolName, event);
    const semanticTool = inferSemanticTool(event.metadata);
    if (semanticTool) return buildToolCall(semanticTool, event);
    if (isTerminalCommand(event)) return buildToolCall(TERMINAL_COMMAND_TOOL_NAME, event);
    return null;
}

/** Anchor 이벤트부터 마지막 이벤트까지의 판정 창을 반환한다. */
export function sliceFromAnchor<T extends { readonly id: string }>(
    events: readonly T[],
    anchorEventId: string,
): readonly T[] | null {
    const at = events.findIndex((event) => event.id === anchorEventId);
    return at === -1 ? null : events.slice(at);
}

/** 이벤트 종류를 규칙 발화자 어휘로 변환한다. */
export function eventSpeaker(kind: string): RuleTriggerSource | "other" {
    if (kind === KIND.userMessage) return "user";
    if (kind === KIND.assistantResponse) return "assistant";
    return "other";
}
