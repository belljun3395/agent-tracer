import type {EventLane, RuntimeIngestEventKind} from "~shared/events/kinds.type.js";
import type {JsonObject} from "~claude-code/hooks/util/utils.type.js";

export interface TranscriptIngestEvent {
    kind: RuntimeIngestEventKind;
    taskId: string;
    sessionId: string;
    title: string;
    body?: string;
    lane: EventLane;
    metadata: JsonObject;
    createdAt?: string;
    [key: string]: unknown;
}

export interface TranscriptEventIds {
    taskId: string;
    sessionId: string;
}

export interface TranscriptAssistantEmitContext {
    entry: TranscriptEntry;
    ids: TranscriptEventIds;
    hasToolUseInMessage: boolean;
}

export interface TranscriptUsage {
    input_tokens?: number;
    output_tokens?: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
}

export interface TranscriptAssistantContentBlock {
    type?: string;
    thinking?: string;
    signature?: string;
    text?: string;
    id?: string;
    name?: string;
    input?: unknown;
}

export interface TranscriptAssistantMessage {
    role?: string;
    stop_reason?: string;
    usage?: TranscriptUsage;
    content?: TranscriptAssistantContentBlock[];
    id?: string;
    model?: string;
}

export interface TranscriptEntry {
    type?: string;
    uuid?: string;
    parentUuid?: string | null;
    timestamp?: string;
    sessionId?: string;
    requestId?: string;
    message?: TranscriptAssistantMessage;
    attachment?: JsonObject;
    subtype?: string;
    isSidechain?: boolean;
}
