import { createSdkMcpServer, tool, type McpSdkServerConfigWithInstance } from "@anthropic-ai/claude-agent-sdk";
import type { ZodRawShape } from "zod";
import { toolFailureText, unknownToolText } from "./tool.failure.js";
import type { ToolHandlers } from "./llm.runner.js";

/** 백엔드 어댑터가 각자의 방언으로 바꾸는 도구 계약의 구조적 표현이다. */
export interface LlmToolDefinition {
    readonly name: string;
    readonly description: string;
    readonly shape: ZodRawShape;
}

/** 도구 계약과 핸들러를 Claude Agent SDK 인프로세스 MCP 서버로 노출한다. */
export function buildMcpToolServer(
    serverName: string,
    tools: readonly LlmToolDefinition[],
    handlers: ToolHandlers,
): McpSdkServerConfigWithInstance {
    return createSdkMcpServer({
        name: serverName,
        tools: tools.map((spec) =>
            tool(spec.name, spec.description, spec.shape, async (args: Record<string, unknown>) => ({
                content: [{ type: "text" as const, text: await invoke(handlers, spec.name, args) }],
            })),
        ),
    });
}

async function invoke(handlers: ToolHandlers, name: string, args: Record<string, unknown>): Promise<string> {
    const handler = handlers[name];
    if (handler === undefined) return unknownToolText(name, Object.keys(handlers));
    try {
        return await handler(args);
    } catch (err) {
        return toolFailureText(name, err);
    }
}
