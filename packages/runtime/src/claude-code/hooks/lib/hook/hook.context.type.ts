import type {JsonObject} from "~shared/util/utils.type.js";

export interface HookSessionContext {
    readonly payload: JsonObject;
    readonly sessionId: string;
    readonly agentId?: string;
    readonly agentType?: string;
    readonly model?: string;
    readonly permissionMode?: string;
    readonly transcriptPath?: string;
    readonly cwd?: string;
}

export interface ToolHookContext extends HookSessionContext {
    readonly toolName: string;
    readonly toolInput: JsonObject;
    readonly toolUseId?: string;
}
