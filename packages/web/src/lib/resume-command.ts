export interface ResumeCommandSpec {
    readonly label: string;
    readonly command: string;
}
export function buildResumeCommand(runtimeSource: string | undefined, sessionId: string | undefined): ResumeCommandSpec | null {
    if (!sessionId)
        return null;
    switch (runtimeSource) {
        case "claude-plugin":
        case "claude-hook":
            return { label: "Claude Code", command: `claude --resume ${sessionId}` };
        default:
            return null;
    }
}
