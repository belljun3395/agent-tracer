/**
 * Wall-clock deadline for a Claude Agent SDK query().
 *
 * query() exposes no per-call init/spawn timeout (initializeTimeoutMs lives
 * only on startup()/WarmQuery), and maxTurns bounds turns, not time. So a
 * spawned `claude` CLI that wedges before/at init makes `for await (msg of q)`
 * hang forever — which pins the calling worker's `running` flag and stalls its
 * whole job lane. The only cancellation channel the query() path supports is
 * options.abortController, so arm a timer that aborts it and clean the timer up
 * in a finally. On abort the generator stops, generate() throws/returns empty,
 * and the caller marks the job failed instead of hanging.
 */
export interface AgentDeadline {
    readonly controller: AbortController;
    readonly dispose: () => void;
}

export function createAgentDeadline(deadlineMs: number): AgentDeadline {
    const controller = new AbortController();
    const timer = setTimeout(() => {
        controller.abort(new Error(`Claude Agent SDK query exceeded ${deadlineMs}ms deadline`));
    }, deadlineMs);
    // Don't keep the process alive just for this timer.
    if (typeof timer.unref === "function") timer.unref();
    return {
        controller,
        dispose: () => clearTimeout(timer),
    };
}
