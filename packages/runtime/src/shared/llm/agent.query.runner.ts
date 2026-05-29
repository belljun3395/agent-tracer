import type { AgentQueryRequest, AgentQueryResult } from "./agent.query.type.js";

/**
 * Minimal local view of the Claude Agent SDK `query()` we depend on. The full
 * SDK types live in the (optional) @anthropic-ai/claude-agent-sdk package; we
 * type only what we read so the runtime stays strict (no `any`) and compiles
 * whether or not the optional dependency is installed.
 */
interface SdkMessage {
    readonly type: string;
    readonly message?: { readonly content?: ReadonlyArray<{ readonly type?: string; readonly text?: string }> };
    readonly subtype?: string;
    readonly result?: string;
    readonly errors?: readonly string[];
}

type QueryFn = (args: { prompt: string; options: Record<string, unknown> }) => AsyncIterable<SdkMessage>;

// `: string` (not a literal) so TS treats the dynamic import as unresolved —
// the optional dependency need not be present at type-check time.
const SDK_MODULE: string = "@anthropic-ai/claude-agent-sdk";

export class AgentSdkUnavailableError extends Error {
    constructor() {
        super(
            "@anthropic-ai/claude-agent-sdk is not installed. The runtime LLM worker " +
                "needs it to run agents locally; install it, or set MONITOR_LLM_RUNNER=local " +
                "on the server to run agents in-process instead.",
        );
        this.name = "AgentSdkUnavailableError";
    }
}

async function loadQuery(): Promise<QueryFn> {
    let mod: { query?: unknown };
    try {
        mod = (await import(SDK_MODULE)) as { query?: unknown };
    } catch {
        throw new AgentSdkUnavailableError();
    }
    if (typeof mod.query !== "function") throw new AgentSdkUnavailableError();
    return mod.query as QueryFn;
}

/**
 * Runs one Claude Agent SDK `query()` locally — where the workspace lives —
 * and returns the collected text. Mirrors the server LocalQueryRunner loop.
 * Throws {@link AgentSdkUnavailableError} if the SDK isn't installed.
 */
export async function runAgentQuery(request: AgentQueryRequest): Promise<AgentQueryResult> {
    const query = await loadQuery();
    const controller = new AbortController();
    const timer = setTimeout(() => {
        controller.abort(new Error(`Claude Agent SDK query exceeded ${request.deadlineMs}ms deadline`));
    }, request.deadlineMs);
    if (typeof timer.unref === "function") timer.unref();

    const startedAt = Date.now();
    let collected = "";
    let resultText = "";
    let errorSummary: string | null = null;
    const tools = [...request.allowedTools];

    try {
        const q = query({
            prompt: request.prompt,
            options: {
                abortController: controller,
                ...(request.cwd ? { cwd: request.cwd } : {}),
                model: request.model,
                allowedTools: tools,
                tools,
                maxTurns: request.maxTurns,
                systemPrompt: request.systemPrompt,
                // Merge the runtime's own env (incl. its local ANTHROPIC_API_KEY)
                // with the request extras (MONITOR_TASK_*). The server never sends a key.
                env: { ...process.env, ...request.env },
                permissionMode: "bypassPermissions",
                strictMcpConfig: true,
                includePartialMessages: false,
            },
        });

        for await (const msg of q) {
            if (msg.type === "assistant") {
                for (const block of msg.message?.content ?? []) {
                    if (block.type === "text" && typeof block.text === "string") {
                        collected += block.text;
                    }
                }
                continue;
            }
            if (msg.type === "result") {
                const errs = msg.errors ?? [];
                if (msg.subtype === "success") {
                    resultText = msg.result ?? "";
                } else {
                    errorSummary = `${msg.subtype ?? "error"}${errs.length > 0 ? `: ${errs.join("; ")}` : ""}`;
                }
                break;
            }
        }
    } finally {
        clearTimeout(timer);
    }

    return {
        rawOutput: resultText || collected,
        durationMs: Date.now() - startedAt,
        errorSummary,
    };
}
