import { AGENT, CHAT_TOOL } from "@monitor/kernel";
import { generateUlid } from "@monitor/platform";
import { logInfo, withToolTelemetry, type ToolHandlers } from "@monitor/llm-runtime";
import { ChatUserMemoryEntity } from "@monitor/tracer-domain";
import { parseChatToolArgs, strArg as str } from "~tracer-api/domain/chat/model/chat.tool.schema.js";
import type { ChatTurnSink } from "~tracer-api/domain/chat/model/chat.turn.model.js";
import type { ClockPort } from "~tracer-api/domain/chat/port/clock.port.js";
import type { ChatUserMemoryRepositoryPort } from "~tracer-api/domain/chat/port/chat.repository.port.js";

const AGENT_NAME = AGENT.chat.id;

/** 장기기억 도구가 읽고 쓰는 저장소와, remember_fact의 새 id를 찍는 시계다. */
export interface ChatMemoryToolDeps {
    readonly memories: ChatUserMemoryRepositoryPort;
    readonly clock: ClockPort;
}

/** 한 턴에서 장기기억 도구가 어느 사용자에 매이고, 어디로 갱신 통지를 흘리는지다. */
export interface ChatMemoryToolContext {
    readonly userId: string;
    readonly sink: ChatTurnSink;
}

function telemetered<T>(toolName: string, parameters: unknown, run: () => Promise<T>): Promise<T> {
    return withToolTelemetry({ toolName, agentName: AGENT_NAME, parameters }, run);
}

/** 확인 게이트를 거치지 않고 즉시 실행하는 장기기억 도구 핸들러 둘(recall_facts 읽기, remember_fact 즉시 적재 후 투명성 통지)을 만든다. */
export function buildChatMemoryToolHandlers(ctx: ChatMemoryToolContext, deps: ChatMemoryToolDeps): ToolHandlers {
    return {
        [CHAT_TOOL.recallFacts]: async (raw) => {
            parseChatToolArgs(CHAT_TOOL.recallFacts, raw);
            return telemetered(CHAT_TOOL.recallFacts, {}, async () => {
                const rows = await deps.memories.listByUser(ctx.userId);
                const facts = rows.map((row) => ({
                    key: row.key,
                    content: row.content,
                    updatedAt: row.updatedAt.toISOString(),
                }));
                return JSON.stringify({ facts });
            });
        },

        [CHAT_TOOL.rememberFact]: async (raw) => {
            const args = parseChatToolArgs(CHAT_TOOL.rememberFact, raw);
            const key = str(args["key"])!;
            const content = str(args["content"])!;
            return telemetered(CHAT_TOOL.rememberFact, { key }, async () => {
                const now = deps.clock.now();
                const memory = ChatUserMemoryEntity.create({
                    id: generateUlid(now.getTime()),
                    userId: ctx.userId,
                    key,
                    content,
                    now,
                });
                await deps.memories.upsert(memory);
                ctx.sink.onMemoryUpdated?.({ key, content });
                logInfo({ msg: "chat.memory.remembered", userId: ctx.userId, key });
                return JSON.stringify({ key, content, status: "remembered" });
            });
        },
    };
}
