import type { AiAgentBackend } from "@monitor/kernel";
import type { ChatTurnResult } from "./chat.turn.model.js";

export interface PreparedChatExecution {
    readonly executionId: string;
    readonly threadId: string;
    readonly userId: string;
    readonly backend: AiAgentBackend;
    readonly language: string;
    readonly model?: string;
}

export interface GeneratedChatExecution {
    readonly executionId: string;
    readonly result: ChatTurnResult;
}
