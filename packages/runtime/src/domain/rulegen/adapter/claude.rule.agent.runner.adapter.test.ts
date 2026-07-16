import {delimiter} from "node:path";
import type {SDKMessage} from "@anthropic-ai/claude-agent-sdk";
import {afterEach, describe, expect, it, vi} from "vitest";

vi.mock("node:fs", () => ({
    accessSync: vi.fn(),
    constants: {X_OK: 1},
}));

import {accessSync} from "node:fs";
import {
    buildAgentEnv,
    normalize,
    resolveClaudeExecutablePath,
    toToolArgs,
    toUsage,
} from "~runtime/domain/rulegen/adapter/claude.rule.agent.runner.adapter.js";

function collect<T>(generator: Generator<T>): T[] {
    return [...generator];
}

describe("normalize", () => {
    it("assistant 메시지를 텍스트와 도구 호출과 사용량으로 정규화한다", () => {
        const message = {
            type: "assistant",
            message: {
                content: [
                    {type: "text", text: "턴을 읽는다"},
                    {type: "tool_use", id: "call-1", name: "get_task_turns", input: {taskId: "task-1"}},
                ],
                usage: {input_tokens: 10, output_tokens: 5},
                stop_reason: "tool_use",
            },
        } as unknown as SDKMessage;

        expect(collect(normalize(message))).toEqual([
            {
                type: "assistant",
                text: "턴을 읽는다",
                toolCalls: [{id: "call-1", name: "get_task_turns", args: {taskId: "task-1"}}],
                usage: {inputTokens: 10, outputTokens: 5, cacheReadTokens: 0, cacheCreationTokens: 0},
                stopReason: "tool_use",
            },
        ]);
    });

    it("tool_use 입력이 record가 아니면 빈 args로 떨어진다", () => {
        const message = {
            type: "assistant",
            message: {
                content: [{type: "tool_use", id: "call-1", name: "get_task_turns", input: "not-a-record"}],
                usage: null,
                stop_reason: null,
            },
        } as unknown as SDKMessage;

        const [assistant] = collect(normalize(message));
        expect(assistant).toMatchObject({toolCalls: [{id: "call-1", name: "get_task_turns", args: {}}]});
    });

    it("user 메시지의 tool_result 블록마다 하나씩 낸다", () => {
        const message = {
            type: "user",
            message: {
                content: [
                    {type: "tool_result", tool_use_id: "call-1", content: "사용자가 테스트를 요구했다"},
                    {
                        type: "tool_result",
                        tool_use_id: "call-2",
                        content: [
                            {type: "text", text: "배열 "},
                            {type: "text", text: "블록"},
                            {type: "image", source: {}},
                        ],
                    },
                ],
            },
        } as unknown as SDKMessage;

        expect(collect(normalize(message))).toEqual([
            {type: "tool_result", toolCallId: "call-1", text: "사용자가 테스트를 요구했다"},
            {type: "tool_result", toolCallId: "call-2", text: "배열 블록"},
        ]);
    });

    it("user 메시지 content가 문자열이면 아무것도 내지 않는다", () => {
        const message = {type: "user", message: {content: "그냥 문자열"}} as unknown as SDKMessage;

        expect(collect(normalize(message))).toEqual([]);
    });

    it("성공 result는 구조화 출력을 싣고 errors를 비운다", () => {
        const message = {
            type: "result",
            subtype: "success",
            structured_output: {rules: [{name: "규칙"}]},
            total_cost_usd: 0.25,
            num_turns: 4,
            usage: {input_tokens: 100, output_tokens: 20, cache_read_input_tokens: 5, cache_creation_input_tokens: 1},
        } as unknown as SDKMessage;

        expect(collect(normalize(message))).toEqual([
            {
                type: "result",
                subtype: "success",
                structuredOutput: {rules: [{name: "규칙"}]},
                errors: [],
                costUsd: 0.25,
                numTurns: 4,
                usage: {inputTokens: 100, outputTokens: 20, cacheReadTokens: 5, cacheCreationTokens: 1},
            },
        ]);
    });

    it("실패 result는 구조화 출력을 비우고 errors를 그대로 싣는다", () => {
        const message = {
            type: "result",
            subtype: "error_max_turns",
            errors: ["turn limit"],
            total_cost_usd: 0.1,
            num_turns: 1,
            usage: null,
        } as unknown as SDKMessage;

        expect(collect(normalize(message))).toEqual([
            {
                type: "result",
                subtype: "error_max_turns",
                structuredOutput: null,
                errors: ["turn limit"],
                costUsd: 0.1,
                numTurns: 1,
                usage: null,
            },
        ]);
    });

    it("모르는 message.type은 드롭한다", () => {
        const message = {type: "system", subtype: "init"} as unknown as SDKMessage;

        expect(collect(normalize(message))).toEqual([]);
    });
});

describe("toUsage", () => {
    it("record면 스네이크 케이스 키를 토큰 필드로 옮긴다", () => {
        expect(
            toUsage({
                input_tokens: 1,
                output_tokens: 2,
                cache_read_input_tokens: 3,
                cache_creation_input_tokens: 4,
            }),
        ).toEqual({inputTokens: 1, outputTokens: 2, cacheReadTokens: 3, cacheCreationTokens: 4});
    });

    it("record가 아니면 null이다", () => {
        expect(toUsage(null)).toBeNull();
        expect(toUsage(undefined)).toBeNull();
        expect(toUsage("usage")).toBeNull();
        expect(toUsage([1, 2, 3])).toBeNull();
    });

    it("숫자가 아닌 키는 0으로 읽는다", () => {
        expect(toUsage({input_tokens: "10"})).toEqual({
            inputTokens: 0,
            outputTokens: 0,
            cacheReadTokens: 0,
            cacheCreationTokens: 0,
        });
    });
});

describe("toToolArgs", () => {
    it("record면 그대로 통과시킨다", () => {
        expect(toToolArgs({taskId: "task-1"})).toEqual({taskId: "task-1"});
    });

    it("record가 아니면 빈 객체다", () => {
        expect(toToolArgs("not-a-record")).toEqual({});
        expect(toToolArgs(null)).toEqual({});
        expect(toToolArgs([1, 2])).toEqual({});
    });
});

describe("resolveClaudeExecutablePath", () => {
    afterEach(() => {
        vi.mocked(accessSync).mockReset();
    });

    it("PATH가 비어 있으면 undefined다", () => {
        expect(resolveClaudeExecutablePath({PATH: ""})).toBeUndefined();
    });

    it("PATH가 아예 없으면 undefined다", () => {
        expect(resolveClaudeExecutablePath({})).toBeUndefined();
    });

    it("AGENT_TRACER_CLAUDE_CLI_PATH가 있으면 PATH를 보지 않고 그 경로를 쓴다", () => {
        expect(
            resolveClaudeExecutablePath({AGENT_TRACER_CLAUDE_CLI_PATH: "/opt/claude/claude", PATH: ""}),
        ).toBe("/opt/claude/claude");
    });

    it("AGENT_TRACER_CLAUDE_CLI_PATH가 공백뿐이면 무시하고 PATH로 넘어간다", () => {
        vi.mocked(accessSync).mockImplementation(() => {
            throw new Error("not found");
        });

        expect(resolveClaudeExecutablePath({AGENT_TRACER_CLAUDE_CLI_PATH: "   ", PATH: ""})).toBeUndefined();
    });

    it("PATH의 디렉터리를 순서대로 찾아 실행 가능한 첫 후보를 쓴다", () => {
        vi.mocked(accessSync).mockImplementation((candidate) => {
            if (candidate === "/usr/local/bin/claude") return undefined;
            throw new Error("not found");
        });

        const path = `/usr/bin${delimiter}/usr/local/bin`;
        expect(resolveClaudeExecutablePath({PATH: path})).toBe("/usr/local/bin/claude");
    });

    it("어느 디렉터리에도 없으면 undefined다", () => {
        vi.mocked(accessSync).mockImplementation(() => {
            throw new Error("not found");
        });

        const path = `/usr/bin${delimiter}/usr/local/bin`;
        expect(resolveClaudeExecutablePath({PATH: path})).toBeUndefined();
    });
});

describe("buildAgentEnv", () => {
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it("허용목록 밖 키는 거르고 안쪽 키만 base로 통과시킨다", () => {
        vi.stubEnv("LANG", "ko_KR.UTF-8");
        vi.stubEnv("AGENT_TRACER_TEST_SECRET", "leak-me");

        const env = buildAgentEnv({});

        expect(env["LANG"]).toBe("ko_KR.UTF-8");
        expect(env["AGENT_TRACER_TEST_SECRET"]).toBeUndefined();
    });

    it("overrides가 base 값을 덮어쓰고 새 키도 더한다", () => {
        vi.stubEnv("HOME", "/home/base");

        const env = buildAgentEnv({HOME: "/home/override", ANTHROPIC_API_KEY: "sk-test"});

        expect(env["HOME"]).toBe("/home/override");
        expect(env["ANTHROPIC_API_KEY"]).toBe("sk-test");
    });
});
