import { mkdtemp, mkdir, writeFile, appendFile } from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
    normalizeRolloutTokenCount,
    normalizeRolloutTurnContext,
    resolveRolloutPath,
    tailRolloutEvents,
} from "./rollout.js";

const tmpDirs: string[] = [];

afterEach(() => {
    tmpDirs.length = 0;
});

async function createTempRoot(prefix: string): Promise<string> {
    const dir = await mkdtemp(path.join(os.tmpdir(), prefix));
    tmpDirs.push(dir);
    return dir;
}

const SAMPLE_TOKEN_COUNT = {
    type: "event_msg",
    payload: {
        type: "token_count",
        info: {
            total_token_usage: {
                input_tokens: 49195,
                cached_input_tokens: 4480,
                output_tokens: 1119,
                reasoning_output_tokens: 516,
                total_tokens: 50314,
            },
            last_token_usage: {
                input_tokens: 49195,
                cached_input_tokens: 4480,
                output_tokens: 1119,
                reasoning_output_tokens: 516,
                total_tokens: 50314,
            },
            model_context_window: 950000,
        },
        rate_limits: {
            limit_id: "codex",
            limit_name: null,
            primary: { used_percent: 6.0, window_minutes: 300, resets_at: 1776691885 },
            secondary: { used_percent: 38.0, window_minutes: 10080, resets_at: 1776963683 },
        },
    },
};

describe("normalizeRolloutTokenCount", () => {
    it("maps snake_case fields into the CodexAppServer shapes", () => {
        const out = normalizeRolloutTokenCount(SAMPLE_TOKEN_COUNT.payload);
        expect(out?.tokenUsage?.total.totalTokens).toBe(50314);
        expect(out?.tokenUsage?.total.cachedInputTokens).toBe(4480);
        expect(out?.tokenUsage?.modelContextWindow).toBe(950000);
        expect(out?.rateLimits?.primary?.windowDurationMins).toBe(300);
        expect(out?.rateLimits?.primary?.resetsAt).toBe(1776691885);
        expect(out?.rateLimits?.secondary?.usedPercent).toBe(38.0);
    });

    it("returns rateLimits only when info is null", () => {
        const out = normalizeRolloutTokenCount({
            type: "token_count",
            info: null,
            rate_limits: SAMPLE_TOKEN_COUNT.payload.rate_limits,
        });
        expect(out?.tokenUsage).toBeUndefined();
        expect(out?.rateLimits?.primary?.usedPercent).toBe(6.0);
    });

    it("returns null for unrelated payloads", () => {
        expect(normalizeRolloutTokenCount({ type: "other" })).toBeNull();
        expect(normalizeRolloutTokenCount(null)).toBeNull();
    });
});

describe("normalizeRolloutTurnContext", () => {
    it("extracts turn id and model from a turn_context payload", () => {
        const out = normalizeRolloutTurnContext({
            turn_id: "019dab0c-22dd-74d3-9d14-6945c7128024",
            cwd: "/tmp",
            model: "gpt-5.4",
            personality: "pragmatic",
        });
        expect(out?.kind).toBe("turnContext");
        expect(out?.modelId).toBe("gpt-5.4");
        expect(out?.turnId).toBe("019dab0c-22dd-74d3-9d14-6945c7128024");
    });

    it("returns null when payload has neither field", () => {
        expect(normalizeRolloutTurnContext({ cwd: "/tmp" })).toBeNull();
    });
});

describe("resolveRolloutPath", () => {
    it("locates the most recent rollout by session id across year/month/day folders", async () => {
        const root = await createTempRoot("agent-tracer-rollout-");
        const dayDir = path.join(root, "2026", "04", "20");
        await mkdir(dayDir, { recursive: true });
        const target = path.join(dayDir, "rollout-2026-04-20T20-25-04-abc.jsonl");
        await writeFile(target, "", "utf8");
        // decoy entry that ends with a different id
        await writeFile(path.join(dayDir, "rollout-2026-04-20T21-00-00-other.jsonl"), "", "utf8");

        const found = await resolveRolloutPath("abc", { sessionsRoot: root, timeoutMs: 500 });
        expect(found).toBe(target);
    });

    it("returns the explicit rolloutPath when the file exists", async () => {
        const root = await createTempRoot("agent-tracer-rollout-hint-");
        const direct = path.join(root, "anywhere.jsonl");
        await writeFile(direct, "", "utf8");

        const found = await resolveRolloutPath("abc", { rolloutPath: direct, timeoutMs: 500 });
        expect(found).toBe(direct);
    });

    it("throws when no matching rollout is found within the timeout", async () => {
        const root = await createTempRoot("agent-tracer-rollout-miss-");
        await expect(
            resolveRolloutPath("missing", {sessionsRoot: root, timeoutMs: 400, intervalMs: 100}),
        ).rejects.toThrow(/rollout file not found/i);
    });
});

describe("tailRolloutEvents", () => {
    it("reads token_count and turn_context events from both initial and appended content", async () => {
        const root = await createTempRoot("agent-tracer-rollout-tail-");
        const file = path.join(root, "rollout.jsonl");

        const sessionMeta = {
            type: "session_meta",
            payload: { id: "019d", model_provider: "openai" },
        };
        const turnContext = {
            type: "turn_context",
            payload: { turn_id: "t1", model: "gpt-5.4" },
        };
        await writeFile(
            file,
            `${JSON.stringify(sessionMeta)}\n${JSON.stringify(turnContext)}\n${JSON.stringify(SAMPLE_TOKEN_COUNT)}\n`,
            "utf8",
        );

        const controller = new AbortController();
        const collected: Array<{ kind: string }> = [];
        const consume = (async (): Promise<void> => {
            for await (const payload of tailRolloutEvents(file, controller.signal)) {
                collected.push(payload);
                if (collected.length >= 3) controller.abort();
            }
        })();

        // Append a second token_count event after the stream has started.
        setTimeout(() => {
            void appendFile(
                file,
                `${JSON.stringify({
                    ...SAMPLE_TOKEN_COUNT,
                    payload: {
                        ...SAMPLE_TOKEN_COUNT.payload,
                        info: {
                            ...SAMPLE_TOKEN_COUNT.payload.info,
                            total_token_usage: {
                                ...SAMPLE_TOKEN_COUNT.payload.info.total_token_usage,
                                total_tokens: 60000,
                            },
                        },
                    },
                })}\n`,
                "utf8",
            );
        }, 100);

        await consume;
        expect(collected.length).toBe(3);
        expect(collected.map((x) => x.kind)).toEqual(["turnContext", "tokenCount", "tokenCount"]);
    }, 10_000);
});
