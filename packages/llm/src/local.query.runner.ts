import { Injectable } from "@nestjs/common";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { createAgentDeadline } from "./agent.deadline.js";
import type { AgentQueryRequest, AgentQueryResult, IQueryRunner } from "./query.runner.port.js";

/**
 * Claude Agent SDK `query()` 를 서버 프로세스 안에서 실행한다.
 */
@Injectable()
export class LocalQueryRunner implements IQueryRunner {
    requiresLocalApiKey(): boolean {
        return true;
    }

    async run(request: AgentQueryRequest): Promise<AgentQueryResult> {
        const startedAt = Date.now();
        let collected = "";
        let resultText = "";
        let errorSummary: string | null = null;

        const deadline = createAgentDeadline(request.deadlineMs);
        const tools = [...request.allowedTools];
        const q = query({
            prompt: request.prompt,
            options: {
                abortController: deadline.controller,
                ...(request.cwd ? { cwd: request.cwd } : {}),
                model: request.model,
                allowedTools: tools,
                tools,
                maxTurns: request.maxTurns,
                systemPrompt: request.systemPrompt,
                // Merge the server process env locally; the request only carries
                // the explicit additions (MONITOR_TASK_*, and the key in local mode).
                env: { ...process.env, ...request.env },
                permissionMode: "bypassPermissions",
                strictMcpConfig: true,
                includePartialMessages: false,
            },
        });

        try {
            for await (const msg of q) {
                if (msg.type === "assistant") {
                    for (const block of msg.message.content) {
                        if (block.type === "text") {
                            collected += block.text;
                        }
                    }
                    continue;
                }
                if (msg.type === "result") {
                    if (msg.subtype === "success") {
                        resultText = msg.result;
                    } else {
                        errorSummary = `${msg.subtype}${
                            msg.errors.length > 0 ? `: ${msg.errors.join("; ")}` : ""
                        }`;
                    }
                    break;
                }
            }
        } finally {
            deadline.dispose();
        }

        return {
            rawOutput: resultText || collected,
            durationMs: Date.now() - startedAt,
            errorSummary,
        };
    }
}
