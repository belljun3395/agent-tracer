import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { generateUlid } from "@monitor/platform";
import { logInfo } from "@monitor/llm-runtime";
import { CHAT_MESSAGE_ROLE, ChatMessageEntity } from "@monitor/tracer-domain";
import { CHAT_CLOCK, type ClockPort } from "~tracer-api/domain/chat/port/clock.port.js";
import {
    CHAT_MESSAGE_REPOSITORY,
    CHAT_PENDING_TOOL_REPOSITORY,
    CHAT_THREAD_REPOSITORY,
    type ChatMessageRepositoryPort,
    type ChatPendingToolRepositoryPort,
    type ChatThreadRepositoryPort,
} from "~tracer-api/domain/chat/port/chat.repository.port.js";
import {
    CHAT_TOOL_EXECUTORS,
    type ChatToolExecutorRegistry,
} from "~tracer-api/domain/chat/port/chat.tool.executors.port.js";

export const CHAT_CONFIRM_DECISION = {
    approve: "approve",
    reject: "reject",
} as const;

export type ChatConfirmDecision = (typeof CHAT_CONFIRM_DECISION)[keyof typeof CHAT_CONFIRM_DECISION];

export interface ConfirmToolInput {
    readonly userId: string;
    readonly threadId: string;
    readonly confirmationId: string;
    readonly decision: ChatConfirmDecision;
}

export interface ConfirmToolResult {
    readonly confirmationId: string;
    readonly toolName: string;
    readonly status: string;
    readonly result: string;
}

/** 대기 중인 쓰기 도구 하나를 사용자의 승인/거절로 해소하고, 승인이면 실제 명령을 실행해 결과를 대화에 tool 메시지로 남긴다. */
@Injectable()
export class ConfirmToolUseCase {
    constructor(
        @Inject(CHAT_THREAD_REPOSITORY)
        private readonly threads: ChatThreadRepositoryPort,
        @Inject(CHAT_MESSAGE_REPOSITORY)
        private readonly messages: ChatMessageRepositoryPort,
        @Inject(CHAT_PENDING_TOOL_REPOSITORY)
        private readonly pendingTools: ChatPendingToolRepositoryPort,
        @Inject(CHAT_TOOL_EXECUTORS)
        private readonly executors: ChatToolExecutorRegistry,
        @Inject(CHAT_CLOCK)
        private readonly clock: ClockPort,
    ) {}

    async execute(input: ConfirmToolInput): Promise<ConfirmToolResult> {
        const thread = await this.threads.findById(input.threadId);
        if (thread === null || thread.userId !== input.userId) throw new NotFoundException("Thread not found");

        const pending = await this.pendingTools.findById(input.confirmationId);
        // 남의 스레드에 걸린 확인은 존재 자체를 알리지 않는다.
        if (pending === null || pending.threadId !== input.threadId) throw new NotFoundException("Confirmation not found");
        if (!pending.isPending()) throw new ConflictException("Confirmation already resolved");

        const now = this.clock.now();
        if (input.decision === CHAT_CONFIRM_DECISION.reject) {
            const content = `User rejected the proposed ${pending.toolName}. It was not executed.`;
            pending.reject(now);
            await this.pendingTools.resolve(pending);
            await this.appendToolMessage(input.threadId, pending.id, content, now);
            logInfo({ msg: "chat.tool.rejected", threadId: input.threadId, userId: input.userId, confirmationId: pending.id, toolName: pending.toolName });
            return { confirmationId: pending.id, toolName: pending.toolName, status: pending.status, result: content };
        }

        const executor = this.executors[pending.toolName];
        if (executor === undefined) throw new BadRequestException(`No executor for tool ${pending.toolName}`);
        // 실행이 먼저 성공해야 승인으로 전이하며, 실패하면 대기 행이 남아 재시도할 수 있다.
        const result = await executor(input.userId, pending.args);
        pending.approve(now);
        await this.pendingTools.resolve(pending);
        await this.appendToolMessage(input.threadId, pending.id, result, now);
        logInfo({ msg: "chat.tool.confirmed", threadId: input.threadId, userId: input.userId, confirmationId: pending.id, toolName: pending.toolName });
        return { confirmationId: pending.id, toolName: pending.toolName, status: pending.status, result };
    }

    private async appendToolMessage(threadId: string, toolCallId: string, content: string, now: Date): Promise<void> {
        const message = ChatMessageEntity.create({
            id: generateUlid(now.getTime()),
            threadId,
            role: CHAT_MESSAGE_ROLE.tool,
            content,
            toolCallId,
            now,
        });
        await this.messages.append(message);
    }
}
