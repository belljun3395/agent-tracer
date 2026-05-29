import type { AgentQueryResult, LlmWireJob } from "./agent.query.type.js";
import { runAgentQuery } from "./agent.query.runner.js";

type PostJson = <T>(pathname: string, body: unknown) => Promise<T>;

const CLAIM_PATH = "/ingest/v1/llm-jobs/claim";
const DEFAULT_POLL_INTERVAL_MS = 2000;

export interface LlmJobWorkerOptions {
    readonly postJson: PostJson;
    readonly log?: (message: string) => void;
    readonly pollIntervalMs?: number;
}

export interface LlmJobWorkerHandle {
    readonly stop: () => void;
}

/**
 * Polls the server for LLM agent jobs (active when the server runs with
 * MONITOR_LLM_RUNNER=remote), runs each `query()` locally next to the
 * workspace, and posts the result back. One job at a time — the agent loop is
 * the slow part, and serializing keeps a single laptop predictable.
 */
export function startLlmJobWorker(options: LlmJobWorkerOptions): LlmJobWorkerHandle {
    const { postJson } = options;
    const log = options.log ?? ((): void => {});
    const pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;

    let stopped = false;
    let inFlight = false;

    async function runOne(job: LlmWireJob): Promise<void> {
        const resultPath = `/ingest/v1/llm-jobs/${job.id}/result`;
        try {
            const output: AgentQueryResult = await runAgentQuery(job.input);
            await postJson(resultPath, { ok: true, output });
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            log(`llm-worker job ${job.kind} (${job.id}) failed: ${message}`);
            try {
                await postJson(resultPath, { ok: false, error: message });
            } catch {
                // Best effort — if the report POST also fails, the server-side
                // broker times the job out on its own deadline.
            }
        }
    }

    async function tick(): Promise<void> {
        if (stopped || inFlight) return;
        inFlight = true;
        try {
            const { job } = await postJson<{ job: LlmWireJob | null }>(CLAIM_PATH, {});
            if (job) await runOne(job);
        } catch (err) {
            // Claim failures (server down, network) are expected and transient.
            log(`llm-worker claim failed: ${err instanceof Error ? err.message : String(err)}`);
        } finally {
            inFlight = false;
        }
    }

    const timer = setInterval(() => {
        void tick();
    }, pollIntervalMs);
    if (typeof timer.unref === "function") timer.unref();

    return {
        stop: () => {
            stopped = true;
            clearInterval(timer);
        },
    };
}

/** Whether the runtime should run the LLM job worker (server is in remote mode). */
export function shouldRunLlmJobWorker(env: NodeJS.ProcessEnv = process.env): boolean {
    return (env["MONITOR_LLM_RUNNER"] ?? "").trim().toLowerCase() === "remote";
}
