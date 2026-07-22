import { ViewColumn, ViewEntity } from "typeorm";
import type { ChatExecutionStatus, ChatMessageRole } from "./chat.const.js";
import type { ChatToolCall } from "./chat.message.entity.js";

@ViewEntity({
    name: "agent_chat_thread_view",
    expression: `SELECT id, user_id, summary FROM chat_threads`,
})
export class AgentChatThreadView {
    @ViewColumn() id!: string;
    @ViewColumn({ name: "user_id" }) userId!: string;
    @ViewColumn() summary!: string | null;
}

@ViewEntity({
    name: "agent_chat_execution_view",
    expression: `SELECT id, user_id, thread_id, user_message_id, assistant_message_id, status, created_at FROM chat_executions`,
})
export class AgentChatExecutionView {
    @ViewColumn() id!: string;
    @ViewColumn({ name: "user_id" }) userId!: string;
    @ViewColumn({ name: "thread_id" }) threadId!: string;
    @ViewColumn({ name: "user_message_id" }) userMessageId!: string;
    @ViewColumn({ name: "assistant_message_id" }) assistantMessageId!: string | null;
    @ViewColumn() status!: ChatExecutionStatus;
    @ViewColumn({ name: "created_at" }) createdAt!: Date;
}

@ViewEntity({
    name: "agent_chat_message_view",
    expression: `SELECT id, thread_id, role, content, tool_calls, tool_call_id FROM chat_messages`,
})
export class AgentChatMessageView {
    @ViewColumn() id!: string;
    @ViewColumn({ name: "thread_id" }) threadId!: string;
    @ViewColumn() role!: ChatMessageRole;
    @ViewColumn() content!: string;
    @ViewColumn({ name: "tool_calls" }) toolCalls!: readonly ChatToolCall[] | null;
    @ViewColumn({ name: "tool_call_id" }) toolCallId!: string | null;
}
