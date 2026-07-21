import { CHAT_MUTATION_TOOLS } from "@monitor/kernel";
import { generateUlid } from "@monitor/platform";
import type { ToolHandlers } from "@monitor/llm-runtime";
import { ChatPendingToolEntity } from "@monitor/tracer-domain";
import { parseChatToolArgs } from "~tracer-api/domain/chat/model/chat.tool.schema.js";
import type { ChatTurnSink } from "~tracer-api/domain/chat/model/chat.turn.model.js";
import type { ChatPendingToolRepositoryPort } from "~tracer-api/domain/chat/port/chat.repository.port.js";
import type { ClockPort } from "~tracer-api/domain/chat/port/clock.port.js";

/** 쓰기 도구가 실행 대신 대기 행을 세우고 승인 요청을 흘릴 때 쓰는 저장소와 시계다. */
export interface ChatWriteToolDeps {
    readonly pendingTools: ChatPendingToolRepositoryPort;
    readonly clock: ClockPort;
}

/** 한 턴 안에서 쓰기 도구가 어느 사용자·스레드에 매이고, 어디로 승인 요청을 흘리는지다. */
export interface ChatWriteToolContext {
    readonly userId: string;
    readonly threadId: string;
    readonly sink: ChatTurnSink;
}

/** mutation 도구마다, 실행하지 않고 대기 행을 만든 뒤 승인 요청을 흘리고 "확인 대기" 결과를 모델에 돌려주는 핸들러를 만든다. */
export function buildChatWriteToolHandlers(ctx: ChatWriteToolContext, deps: ChatWriteToolDeps): ToolHandlers {
    const handlers: Record<string, (raw: unknown) => Promise<string>> = {};
    for (const toolName of CHAT_MUTATION_TOOLS) {
        handlers[toolName] = (raw) => proposeMutation(toolName, raw, ctx, deps);
    }
    return handlers;
}

async function proposeMutation(
    toolName: string,
    raw: unknown,
    ctx: ChatWriteToolContext,
    deps: ChatWriteToolDeps,
): Promise<string> {
    const args = parseChatToolArgs(toolName, raw);
    const now = deps.clock.now();
    const id = generateUlid(now.getTime());
    // 이 턴의 어시스턴트 메시지는 아직 적재 전이라 messageId는 확정할 수 없어 null로 둔다.
    const pending = ChatPendingToolEntity.create({ id, threadId: ctx.threadId, messageId: null, toolName, args, now });
    await deps.pendingTools.create(pending);

    const summary = summarizeMutation(toolName, args);
    ctx.sink.onConfirmRequest?.({ id, toolName, summary, args });

    return JSON.stringify({
        confirmationId: id,
        toolName,
        status: "pending",
        summary,
        note: "Queued for user confirmation. This action has NOT run yet and will only run after the user approves it. Tell the user you are awaiting their confirmation; never claim the change is already done.",
    });
}

function summarizeMutation(toolName: string, args: Record<string, unknown>): string {
    const parts = Object.entries(args).map(([key, value]) => `${key}=${formatValue(value)}`);
    return parts.length > 0 ? `${toolName}(${parts.join(", ")})` : toolName;
}

function formatValue(value: unknown): string {
    if (typeof value === "string") return value.length > 80 ? `${value.slice(0, 77)}...` : value;
    return JSON.stringify(value);
}
