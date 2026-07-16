import {accessSync, constants} from "node:fs";
import * as path from "node:path";
import type {SDKMessage} from "@anthropic-ai/claude-agent-sdk";
import type {AiJobStepToolCall} from "@monitor/kernel/job/job.step.const.js";
import type {RuleAgentMessage} from "~runtime/domain/rulegen/model/agent.message.model.js";
import type {RuleGenerationUsage} from "~runtime/domain/rulegen/model/rule.job.model.js";
import {
    rulegenAllowedTools,
    RULEGEN_MCP_SERVER,
    RULEGEN_WORKSPACE_TOOLS,
} from "~runtime/domain/rulegen/model/rulegen.tool.model.js";
import type {
    RuleAgentRunnerPort,
    RuleAgentRunRequest,
} from "~runtime/domain/rulegen/port/rule.agent.runner.port.js";
import {isRecord} from "~runtime/support/json.js";

// Agent SDK 서브프로세스에 넘기는 환경변수 허용목록이며 나머지는 새지 않는다.
const SAFE_ENV_KEYS = [
    "PATH",
    "HOME",
    "USER",
    "LOGNAME",
    "SHELL",
    "LANG",
    "LC_ALL",
    "LC_CTYPE",
    "TZ",
    "TMPDIR",
    "TMP",
    "TEMP",
    "HTTP_PROXY",
    "HTTPS_PROXY",
    "NO_PROXY",
    "http_proxy",
    "https_proxy",
    "no_proxy",
] as const;

/** 배포 플러그인엔 node_modules가 없어 SDK의 바이너리 자동탐색이 실패하므로 PATH의 Claude Code CLI를 찾는다. */
export function resolveClaudeExecutablePath(env: NodeJS.ProcessEnv = process.env): string | undefined {
    const override = env["AGENT_TRACER_CLAUDE_CLI_PATH"]?.trim();
    if (override !== undefined && override.length > 0) return override;

    const pathEnv = env["PATH"];
    if (pathEnv === undefined) return undefined;

    const exeName = process.platform === "win32" ? "claude.exe" : "claude";
    for (const dir of pathEnv.split(path.delimiter)) {
        if (dir.length === 0) continue;
        const candidate = path.join(dir, exeName);
        try {
            accessSync(candidate, constants.X_OK);
            return candidate;
        } catch {
            continue;
        }
    }
    return undefined;
}

export function buildAgentEnv(
    overrides: Readonly<Record<string, string | undefined>>,
): Record<string, string | undefined> {
    const base: Record<string, string | undefined> = {};
    for (const key of SAFE_ENV_KEYS) {
        const value = process.env[key];
        if (value !== undefined) base[key] = value;
    }
    return {...base, ...overrides};
}

export function toUsage(value: unknown): RuleGenerationUsage | null {
    if (!isRecord(value)) return null;
    const read = (key: string): number => (typeof value[key] === "number" ? value[key] : 0);
    return {
        inputTokens: read("input_tokens"),
        outputTokens: read("output_tokens"),
        cacheReadTokens: read("cache_read_input_tokens"),
        cacheCreationTokens: read("cache_creation_input_tokens"),
    };
}

export function toToolArgs(input: unknown): Record<string, unknown> {
    return isRecord(input) ? input : {};
}

export function toolResultText(content: unknown): string {
    if (typeof content === "string") return content;
    if (!Array.isArray(content)) return "";
    let text = "";
    for (const block of content) {
        if (!isRecord(block) || block["type"] !== "text") continue;
        const value = block["text"];
        if (typeof value === "string") text += value;
    }
    return text;
}

export function* normalize(message: SDKMessage): Generator<RuleAgentMessage> {
    if (message.type === "assistant") {
        let text = "";
        const toolCalls: AiJobStepToolCall[] = [];
        for (const block of message.message.content) {
            if (block.type === "text") text += block.text;
            if (block.type === "tool_use") {
                toolCalls.push({id: block.id, name: block.name, args: toToolArgs(block.input)});
            }
        }
        yield {
            type: "assistant",
            text,
            toolCalls,
            usage: toUsage(message.message.usage),
            stopReason: message.message.stop_reason,
        };
        return;
    }
    if (message.type === "user") {
        const content = message.message.content;
        if (typeof content === "string") return;
        for (const block of content) {
            if (block.type !== "tool_result") continue;
            yield {type: "tool_result", toolCallId: block.tool_use_id, text: toolResultText(block.content)};
        }
        return;
    }
    if (message.type === "result") {
        yield {
            type: "result",
            subtype: message.subtype,
            structuredOutput: message.subtype === "success" ? message.structured_output : null,
            errors: message.subtype === "success" ? [] : message.errors,
            costUsd: message.total_cost_usd,
            numTurns: message.num_turns,
            usage: toUsage(message.usage),
        };
    }
}

/** 규칙 생성 명세를 Claude Agent SDK 헤드리스 실행으로 걸고 SDK 메시지를 도메인 메시지로 옮긴다. */
export class ClaudeRuleAgentRunnerAdapter implements RuleAgentRunnerPort {
    constructor(private readonly apiKey?: string) {}

    async *run(request: RuleAgentRunRequest): AsyncIterable<RuleAgentMessage> {
        const {spec, toolset, controller} = request;
        // 훅 번들이 SDK와 zod를 지고 가지 않도록 데몬이 실행하는 시점에만 적재한다.
        const {query} = await import("@anthropic-ai/claude-agent-sdk");
        const {createRulegenMcpServer} = await import("~runtime/domain/rulegen/adapter/rulegen.tool.schema.js");
        const claudeExecutablePath = resolveClaudeExecutablePath();

        const conversation = query({
            prompt: spec.userPrompt,
            options: {
                abortController: controller,
                cwd: spec.workspacePath,
                model: spec.model,
                fallbackModel: spec.fallbackModel,
                allowedTools: rulegenAllowedTools(spec.tools),
                tools: [...RULEGEN_WORKSPACE_TOOLS],
                mcpServers: {[RULEGEN_MCP_SERVER]: createRulegenMcpServer(spec.tools, toolset)},
                maxTurns: spec.maxTurns,
                maxBudgetUsd: spec.maxBudgetUsd,
                effort: spec.effort,
                ...(claudeExecutablePath !== undefined ? {pathToClaudeCodeExecutable: claudeExecutablePath} : {}),
                systemPrompt: {
                    type: "preset",
                    preset: "claude_code",
                    append: spec.systemPrompt,
                    excludeDynamicSections: true,
                },
                outputFormat: {type: "json_schema", schema: spec.outputSchema},
                env: buildAgentEnv({
                    ...(this.apiKey !== undefined ? {ANTHROPIC_API_KEY: this.apiKey} : {}),
                    MONITOR_TASK_ORIGIN: "server-sdk",
                    // SDK 옵션에는 출력 토큰 상한이 없어 CLI가 읽는 환경변수로만 걸 수 있다.
                    CLAUDE_CODE_MAX_OUTPUT_TOKENS: String(spec.maxOutputTokens),
                }),
                // 헤드리스 실행이라 승인 프롬프트를 띄울 수 없다.
                permissionMode: "bypassPermissions",
                allowDangerouslySkipPermissions: true,
                strictMcpConfig: true,
                includePartialMessages: false,
                // persistSession이 false면 SDK가 전사본을 남기지 않는다.
                persistSession: false,
                // 사용자 설정을 실으면 그의 훅과 MCP 서버가 이 실행의 bypassPermissions 아래에서 돌아간다.
                settingSources: [],
            },
        });

        for await (const message of conversation) {
            yield* normalize(message);
        }
    }
}
