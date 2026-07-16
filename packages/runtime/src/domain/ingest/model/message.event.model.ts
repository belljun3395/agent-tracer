import {
    KIND,
    LANE,
    provenEvidence,
    turnOf,
    type IngestTarget,
    type RuntimeIngestEvent,
    type UserMessagePhase,
} from "~runtime/domain/ingest/model/event.model.js";
import type {
    AssistantCommentaryMetadata,
    AssistantResponseMetadata,
    UserMessageMetadata,
    UserPromptExpansionMetadata,
} from "~runtime/domain/ingest/model/session.metadata.model.js";
import {ellipsize, truncate} from "~runtime/support/text.js";

/** 이벤트와 태스크 제목을 자르는 최대 문자 수다. */
export const TITLE_MAX = 120;
const EXPANSION_TITLE_MAX = 200;
const EXPANSION_SNIPPET_MAX = 2_000;

/** 사용자 발화 하나를 원장에 남기는 데 필요한 입력이다. */
export interface UserMessageInput {
    readonly eventId: string;
    readonly messageId: string;
    readonly turnId: string;
    readonly prompt: string;
    readonly phase: UserMessagePhase;
    readonly runtimeSource: string;
    readonly systemNotification?: boolean;
}

export function userMessageEvent(target: IngestTarget, input: UserMessageInput): RuntimeIngestEvent {
    const metadata: UserMessageMetadata = {
        ...provenEvidence("Captured directly by the UserPromptSubmit hook."),
        messageId: input.messageId,
        captureMode: "raw",
        source: input.runtimeSource,
        phase: input.phase,
    };
    return {
        id: input.eventId,
        kind: KIND.userMessage,
        taskId: target.taskId,
        sessionId: target.sessionId,
        turnId: input.turnId,
        lane: LANE.user,
        title: ellipsize(input.prompt, TITLE_MAX),
        body: input.prompt,
        ...(input.systemNotification ? {promptOrigin: "system_notification" as const} : {}),
        metadata,
    };
}

/** 턴을 마무리하는 어시스턴트 응답 입력이다. */
export interface AssistantResponseInput {
    readonly messageId: string;
    readonly stopReason: string;
    readonly message?: string;
    readonly runtimeSource: string;
}

export function assistantResponseEvent(
    target: IngestTarget,
    input: AssistantResponseInput,
): RuntimeIngestEvent {
    const metadata: AssistantResponseMetadata = {
        ...provenEvidence("Emitted by the Stop hook."),
        messageId: input.messageId,
        source: input.runtimeSource,
        stopReason: input.stopReason,
    };
    return {
        kind: KIND.assistantResponse,
        taskId: target.taskId,
        sessionId: target.sessionId,
        ...turnOf(target),
        lane: LANE.assistant,
        title: input.message ? ellipsize(input.message, TITLE_MAX) : `Response (${input.stopReason})`,
        ...(input.message ? {body: input.message} : {}),
        metadata,
    };
}

/** 모델 오류로 끝난 턴의 입력이다. */
export interface TurnFailureInput {
    readonly messageId: string;
    readonly errorType: string;
    readonly errorMessage?: string;
    readonly runtimeSource: string;
}

export function turnFailedEvent(target: IngestTarget, input: TurnFailureInput): RuntimeIngestEvent {
    const metadata: AssistantResponseMetadata = {
        ...provenEvidence("Emitted by the StopFailure hook."),
        messageId: input.messageId,
        source: input.runtimeSource,
        stopReason: `error:${input.errorType}`,
    };
    return {
        kind: KIND.assistantResponse,
        taskId: target.taskId,
        sessionId: target.sessionId,
        ...turnOf(target),
        lane: LANE.assistant,
        title: `Turn failed (${input.errorType})`,
        ...(input.errorMessage ? {body: input.errorMessage} : {}),
        metadata,
    };
}

/** 도구 호출 사이에 나온 어시스턴트 중간 발화의 입력이다. */
export interface AssistantCommentaryInput {
    readonly eventId: string;
    readonly text: string;
    readonly source: string;
    readonly sourceId: string;
    readonly contentIndex: number;
    readonly assistantUuid: string;
    readonly parentUuid?: string;
    readonly requestId?: string;
}

export function assistantCommentaryEvent(
    target: IngestTarget,
    input: AssistantCommentaryInput,
): RuntimeIngestEvent {
    const metadata: AssistantCommentaryMetadata = {
        ...provenEvidence("Claude Code transcript의 tool_use 중간 발화를 직접 수집했다."),
        messageId: input.eventId,
        source: input.source,
        sourceId: input.sourceId,
        phase: "commentary",
        contentIndex: input.contentIndex,
        assistantUuid: input.assistantUuid,
        ...(input.parentUuid !== undefined ? {parentUuid: input.parentUuid} : {}),
        ...(input.requestId !== undefined ? {requestId: input.requestId} : {}),
    };
    return {
        id: input.eventId,
        kind: KIND.assistantCommentary,
        taskId: target.taskId,
        sessionId: target.sessionId,
        ...turnOf(target),
        lane: LANE.assistant,
        title: ellipsize(input.text, TITLE_MAX),
        body: input.text,
        metadata,
    };
}

/** 슬래시 커맨드가 완전한 프롬프트로 펼쳐진 사실의 입력이다. */
export interface PromptExpansionInput {
    readonly expansionType: string;
    readonly commandName: string;
    readonly commandArgs?: string;
    readonly commandSource?: string;
    readonly expandedPrompt?: string;
}

export function promptExpansionEvent(
    target: IngestTarget,
    input: PromptExpansionInput,
): RuntimeIngestEvent {
    const expanded = input.expandedPrompt ?? "";
    const snippet = expanded.length > EXPANSION_SNIPPET_MAX
        ? `${truncate(expanded, EXPANSION_SNIPPET_MAX)}…`
        : expanded;
    const argsLabel = input.commandArgs ? ` ${input.commandArgs}` : "";

    const metadata: UserPromptExpansionMetadata = {
        ...provenEvidence("Observed directly by the UserPromptExpansion hook."),
        expansionType: input.expansionType,
        commandName: input.commandName,
        ...(input.commandArgs !== undefined ? {commandArgs: input.commandArgs} : {}),
        ...(input.commandSource !== undefined ? {commandSource: input.commandSource} : {}),
        ...(snippet ? {expandedPromptSnippet: snippet} : {}),
        ...(expanded ? {expandedPromptBytes: Buffer.byteLength(expanded, "utf8")} : {}),
    };
    return {
        kind: KIND.userPromptExpansion,
        taskId: target.taskId,
        sessionId: target.sessionId,
        ...turnOf(target),
        lane: LANE.user,
        title: truncate(`Slash: /${input.commandName}${argsLabel}`, EXPANSION_TITLE_MAX),
        ...(snippet ? {body: snippet} : {}),
        metadata,
    };
}
