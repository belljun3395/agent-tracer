import {accessSync, constants} from "node:fs";
import * as path from "node:path";
import type {
    RuleGenerationOutcome,
    RuleGenerationUsage,
} from "~runtime/domain/rulegen/model/rule.job.model.js";
import type {RuleGenerationSpec} from "~runtime/domain/rulegen/model/rulegen.spec.model.js";
import {
    rulegenAllowedTools,
    RULEGEN_MCP_SERVER,
    RULEGEN_WORKSPACE_TOOLS,
    type RulegenToolset,
} from "~runtime/domain/rulegen/model/rulegen.tool.model.js";
import type {RuleGeneratorPort} from "~runtime/domain/rulegen/port/rule.generator.port.js";
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

function toUsage(value: unknown): RuleGenerationUsage | null {
    if (!isRecord(value)) return null;
    const read = (key: string): number => (typeof value[key] === "number" ? value[key] : 0);
    return {
        inputTokens: read("input_tokens"),
        outputTokens: read("output_tokens"),
        cacheReadTokens: read("cache_read_input_tokens"),
        cacheCreationTokens: read("cache_creation_input_tokens"),
    };
}

function toCandidates(structured: unknown): readonly unknown[] {
    if (!isRecord(structured)) return [];
    const rules = structured["rules"];
    return Array.isArray(rules) ? rules : [];
}

/** 규칙 생성 명세를 도구 루프가 붙은 Claude Agent SDK 헤드리스 실행으로 돌린다. */
export class AgentRuleGeneratorAdapter implements RuleGeneratorPort {
    constructor(private readonly apiKey?: string) {}

    async generate(
        spec: RuleGenerationSpec,
        toolset: RulegenToolset,
        signal: AbortSignal,
    ): Promise<RuleGenerationOutcome> {
        const controller = new AbortController();
        const abort = (): void => controller.abort(signal.reason);
        if (signal.aborted) abort();
        else signal.addEventListener("abort", abort, {once: true});

        try {
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
                    allowedTools: rulegenAllowedTools(spec.tools),
                    tools: [...RULEGEN_WORKSPACE_TOOLS],
                    mcpServers: {[RULEGEN_MCP_SERVER]: createRulegenMcpServer(spec.tools, toolset)},
                    maxTurns: spec.maxTurns,
                    maxBudgetUsd: spec.maxBudgetUsd,
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
                    }),
                    // 헤드리스 실행이라 승인 프롬프트를 띄울 수 없다.
                    permissionMode: "bypassPermissions",
                    allowDangerouslySkipPermissions: true,
                    strictMcpConfig: true,
                    includePartialMessages: false,
                    // persistSession이 false면 SDK가 전사본을 남기지 않는다.
                    persistSession: false,
                    // project 설정을 로드하면 워크스페이스의 훅이 bypassPermissions로 실행된다.
                    settingSources: ["user"],
                },
            });

            for await (const message of conversation) {
                if (message.type !== "result") continue;
                if (message.subtype === "success") {
                    return {
                        candidates: toCandidates(message.structured_output),
                        costUsd: message.total_cost_usd,
                        numTurns: message.num_turns,
                        usage: toUsage(message.usage),
                        error: null,
                    };
                }
                const errors = message.errors.length > 0 ? `: ${message.errors.join("; ")}` : "";
                return {
                    candidates: [],
                    costUsd: message.total_cost_usd,
                    numTurns: message.num_turns,
                    usage: toUsage(message.usage),
                    error: `${message.subtype}${errors}`,
                };
            }
            return {candidates: [], costUsd: null, numTurns: null, usage: null, error: "no result message"};
        } catch (error) {
            return {
                candidates: [],
                costUsd: null,
                numTurns: null,
                usage: null,
                error: error instanceof Error ? error.message : String(error),
            };
        } finally {
            signal.removeEventListener("abort", abort);
        }
    }
}
