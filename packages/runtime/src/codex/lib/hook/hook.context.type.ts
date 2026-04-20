import type {JsonObject} from "~codex/util/utils.js";

export interface HookSessionContext {
    readonly payload: JsonObject;
    readonly sessionId: string;
}

export interface ToolHookContext extends HookSessionContext {
    readonly toolName: string;
    readonly toolInput: JsonObject;
    readonly toolUseId?: string;
}
