import { Body, Controller, Delete, Get, Headers, HttpCode, HttpStatus, Param, Patch, Post, Res } from "@nestjs/common";
import type { Response } from "express";
import { CHAT_THREADS_PATH, MONITOR_USER_HEADER } from "@monitor/kernel";
import { pathParamPipe } from "~tracer-api/support/path-param.pipe.js";
import { resolveUserId } from "~tracer-api/support/request-user.js";
import { SchemaValidationPipe } from "~tracer-api/support/schema.validation.pipe.js";
import { CreateThreadUseCase } from "~tracer-api/domain/chat/application/command/create.thread.usecase.js";
import { EnqueueChatTurnUseCase } from "~tracer-api/domain/chat/application/command/enqueue.chat.turn.usecase.js";
import { CancelChatExecutionUseCase } from "~tracer-api/domain/chat/application/command/cancel.chat.execution.usecase.js";
import { ConfirmToolUseCase } from "~tracer-api/domain/chat/application/command/confirm.tool.usecase.js";
import { DeleteThreadUseCase } from "~tracer-api/domain/chat/application/command/delete.thread.usecase.js";
import { RenameThreadUseCase } from "~tracer-api/domain/chat/application/command/rename.thread.usecase.js";
import { ListThreadsUseCase } from "~tracer-api/domain/chat/application/query/list.threads.usecase.js";
import { GetThreadUseCase } from "~tracer-api/domain/chat/application/query/get.thread.usecase.js";
import { GetMessagesUseCase } from "~tracer-api/domain/chat/application/query/get.messages.usecase.js";
import { ListChatExecutionsUseCase } from "~tracer-api/domain/chat/application/query/list.chat.executions.usecase.js";
import { WatchChatExecutionUseCase } from "~tracer-api/domain/chat/application/query/watch.chat.execution.usecase.js";
import { SseWriter } from "~tracer-api/domain/chat/inbound/chat.sse.writer.js";
import {
    confirmToolSchema,
    createThreadSchema,
    postMessageSchema,
    renameThreadSchema,
    type ConfirmToolPayload,
    type CreateThreadPayload,
    type PostMessagePayload,
    type RenameThreadPayload,
} from "./chat.schema.js";

/** 대화 스레드와 연결보다 오래 사는 비동기 턴 실행의 HTTP 계약을 제공한다. */
@Controller(CHAT_THREADS_PATH)
export class ChatController {
    constructor(
        private readonly listThreads: ListThreadsUseCase,
        private readonly getThread: GetThreadUseCase,
        private readonly getMessages: GetMessagesUseCase,
        private readonly createThread: CreateThreadUseCase,
        private readonly enqueueChatTurn: EnqueueChatTurnUseCase,
        private readonly listChatExecutions: ListChatExecutionsUseCase,
        private readonly watchChatExecution: WatchChatExecutionUseCase,
        private readonly cancelChatExecution: CancelChatExecutionUseCase,
        private readonly confirmTool: ConfirmToolUseCase,
        private readonly deleteThread: DeleteThreadUseCase,
        private readonly renameThread: RenameThreadUseCase,
    ) {}

    @Get()
    async list(@Headers(MONITOR_USER_HEADER) user: string | undefined) {
        return this.listThreads.execute(resolveUserId(user));
    }

    @Post()
    @HttpCode(HttpStatus.CREATED)
    async create(
        @Headers(MONITOR_USER_HEADER) user: string | undefined,
        @Body(new SchemaValidationPipe(createThreadSchema)) body: CreateThreadPayload,
    ) {
        return this.createThread.execute({ userId: resolveUserId(user), title: body.title });
    }

    @Get(":threadId")
    async detail(
        @Headers(MONITOR_USER_HEADER) user: string | undefined,
        @Param("threadId", pathParamPipe) threadId: string,
    ) {
        return this.getThread.execute(resolveUserId(user), threadId);
    }

    @Get(":threadId/messages")
    async messages(
        @Headers(MONITOR_USER_HEADER) user: string | undefined,
        @Param("threadId", pathParamPipe) threadId: string,
    ) {
        return this.getMessages.execute(resolveUserId(user), threadId);
    }

    @Patch(":threadId")
    async rename(
        @Headers(MONITOR_USER_HEADER) user: string | undefined,
        @Param("threadId", pathParamPipe) threadId: string,
        @Body(new SchemaValidationPipe(renameThreadSchema)) body: RenameThreadPayload,
    ) {
        return this.renameThread.execute({ userId: resolveUserId(user), threadId, title: body.title });
    }

    @Delete(":threadId")
    @HttpCode(HttpStatus.OK)
    async remove(
        @Headers(MONITOR_USER_HEADER) user: string | undefined,
        @Param("threadId", pathParamPipe) threadId: string,
    ) {
        return this.deleteThread.execute(resolveUserId(user), threadId);
    }

    @Post(":threadId/messages")
    @HttpCode(HttpStatus.ACCEPTED)
    async send(
        @Headers(MONITOR_USER_HEADER) user: string | undefined,
        @Param("threadId", pathParamPipe) threadId: string,
        @Body(new SchemaValidationPipe(postMessageSchema)) body: PostMessagePayload,
    ) {
        return this.enqueueChatTurn.execute({
            userId: resolveUserId(user),
            threadId,
            clientRequestId: body.clientRequestId,
            content: body.content,
            ...(body.model !== undefined ? { model: body.model } : {}),
            ...(body.agentBackend !== undefined ? { agentBackend: body.agentBackend } : {}),
            ...(body.language !== undefined ? { language: body.language } : {}),
        });
    }

    @Get(":threadId/executions")
    async executions(
        @Headers(MONITOR_USER_HEADER) user: string | undefined,
        @Param("threadId", pathParamPipe) threadId: string,
    ) {
        return this.listChatExecutions.execute(resolveUserId(user), threadId);
    }

    @Get(":threadId/executions/:executionId/events")
    async executionEventStream(
        @Headers(MONITOR_USER_HEADER) user: string | undefined,
        @Param("threadId", pathParamPipe) threadId: string,
        @Param("executionId", pathParamPipe) executionId: string,
        @Res() response: Response,
    ): Promise<void> {
        const userId = resolveUserId(user);
        await this.watchChatExecution.snapshot(userId, threadId, executionId);
        response.status(HttpStatus.OK);
        response.setHeader("Content-Type", "text/event-stream");
        response.setHeader("Cache-Control", "no-cache, no-transform");
        response.setHeader("Connection", "keep-alive");
        response.setHeader("X-Accel-Buffering", "no");
        response.flushHeaders();

        const writer = new SseWriter(response);
        let closed = false;
        let refreshTail = Promise.resolve();
        let unsubscribe = (): void => undefined;
        let heartbeat: ReturnType<typeof setInterval> | null = null;
        const close = (): void => {
            if (closed) return;
            closed = true;
            if (heartbeat !== null) clearInterval(heartbeat);
            unsubscribe();
            writer.close();
        };
        const send = async (snapshot: Awaited<ReturnType<WatchChatExecutionUseCase["snapshot"]>>): Promise<void> => {
            if (closed) return;
            await writer.write("snapshot", snapshot, executionEventId(snapshot.execution));
            if (isTerminalExecution(snapshot.execution.status)) response.end();
        };
        const refresh = (): void => {
            refreshTail = refreshTail.then(async () => {
                const snapshot = await this.watchChatExecution.snapshot(userId, threadId, executionId);
                await send(snapshot);
            }).catch(() => close());
        };
        unsubscribe = this.watchChatExecution.subscribe(executionId, refresh);
        heartbeat = setInterval(() => {
            if (!closed) response.write(": heartbeat\n\n");
        }, 20_000);
        response.once("close", close);
        refresh();
        await refreshTail;
    }

    @Post(":threadId/executions/:executionId/cancel")
    async cancelExecution(
        @Headers(MONITOR_USER_HEADER) user: string | undefined,
        @Param("threadId", pathParamPipe) threadId: string,
        @Param("executionId", pathParamPipe) executionId: string,
    ) {
        return this.cancelChatExecution.execute(resolveUserId(user), threadId, executionId);
    }

    @Post(":threadId/confirmations/:confirmationId")
    @HttpCode(HttpStatus.OK)
    async confirm(
        @Headers(MONITOR_USER_HEADER) user: string | undefined,
        @Param("threadId", pathParamPipe) threadId: string,
        @Param("confirmationId", pathParamPipe) confirmationId: string,
        @Body(new SchemaValidationPipe(confirmToolSchema)) body: ConfirmToolPayload,
    ) {
        return this.confirmTool.execute({
            userId: resolveUserId(user),
            threadId,
            confirmationId,
            decision: body.decision,
        });
    }

}

function executionEventId(execution: { readonly draftSeq: number; readonly updatedAt: string }): string {
    return `${execution.draftSeq}:${execution.updatedAt}`;
}

function isTerminalExecution(status: string): boolean {
    return status === "completed" || status === "failed" || status === "canceled";
}
