
export interface AgentDeadline {
    readonly controller: AbortController;
    readonly dispose: () => void;
}

export function createAgentDeadline(deadlineMs: number): AgentDeadline {
    const controller = new AbortController();
    const timer = setTimeout(() => {
        controller.abort(new Error(`Claude Agent SDK query exceeded ${deadlineMs}ms deadline`));
    }, deadlineMs);

    if (typeof timer.unref === "function") timer.unref();
    return {
        controller,
        dispose: () => clearTimeout(timer),
    };
}
