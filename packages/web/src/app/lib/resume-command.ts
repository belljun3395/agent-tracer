import { CLAUDE_HOOK_SOURCE, CLAUDE_PLUGIN_SOURCE } from "../../types/runtime-capabilities.types.js";

export interface ResumeCommandSpec {
    readonly label: string;
    readonly command: string;
}
export function buildResumeCommand(runtimeSource: string | undefined, sessionId: string | undefined): ResumeCommandSpec | null {
    if (!sessionId)
        return null;
    switch (runtimeSource) {
        case CLAUDE_PLUGIN_SOURCE:
        case CLAUDE_HOOK_SOURCE:
            return { label: "Claude Code", command: `claude --resume ${sessionId}` };
        default:
            return null;
    }
}
