import type {JsonObject} from "~codex/util/utils.js";

export interface HookSessionContext {
    readonly payload: JsonObject;
    readonly sessionId: string;
    readonly model?: string;
    readonly cwd?: string;
    readonly transcriptPath?: string;
}

export interface TurnHookContext extends HookSessionContext {
    readonly turnId?: string;
}

export interface ToolHookContext extends TurnHookContext {
    readonly toolName: string;
    readonly toolInput: JsonObject;
    readonly toolUseId?: string;
}
