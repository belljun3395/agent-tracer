import { Body, Controller, Delete, Get, Headers, HttpCode, HttpStatus, Param, Patch, Post, Res } from "@nestjs/common";
import type { Response } from "express";
import { CHAT_THREADS_PATH, MONITOR_USER_HEADER } from "@monitor/kernel";
import { errorMessage } from "@monitor/llm-runtime";
import { pathParamPipe } from "~tracer-api/support/path-param.pipe.js";
import { resolveUserId } from "~tracer-api/support/request-user.js";
import { SchemaValidationPipe } from "~tracer-api/support/schema.validation.pipe.js";
import { NoEnvelope } from "~tracer-api/support/no-envelope.decorator.js";
import { CreateThreadUseCase } from "~tracer-api/domain/chat/application/command/create.thread.usecase.js";
import { AppendUserMessageUseCase } from "~tracer-api/domain/chat/application/command/append.user.message.usecase.js";
import { RunChatTurnUseCase } from "~tracer-api/domain/chat/application/command/run.chat.turn.usecase.js";
import { ConfirmToolUseCase } from "~tracer-api/domain/chat/application/command/confirm.tool.usecase.js";
import { DeleteThreadUseCase } from "~tracer-api/domain/chat/application/command/delete.thread.usecase.js";
import { RenameThreadUseCase } from "~tracer-api/domain/chat/application/command/rename.thread.usecase.js";
import { ListThreadsUseCase } from "~tracer-api/domain/chat/application/query/list.threads.usecase.js";
import { GetThreadUseCase } from "~tracer-api/domain/chat/application/query/get.thread.usecase.js";
import { GetMessagesUseCase } from "~tracer-api/domain/chat/application/query/get.messages.usecase.js";
import type { ChatTurnSink } from "~tracer-api/domain/chat/model/chat.turn.model.js";
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

/** 대화 스레드 조회·생성과, 한 턴을 SSE로 흘려보내는 HTTP 계약을 제공한다. */
@Controller(CHAT_THREADS_PATH)
export class ChatController {
    constructor(
        private readonly listThreads: ListThreadsUseCase,
        private readonly getThread: GetThreadUseCase,
        private readonly getMessages: GetMessagesUseCase,
        private readonly createThread: CreateThreadUseCase,
        private readonly appendUserMessage: AppendUserMessageUseCase,
        private readonly runChatTurn: RunChatTurnUseCase,
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
    @NoEnvelope()
    async send(
        @Headers(MONITOR_USER_HEADER) user: string | undefined,
        @Param("threadId", pathParamPipe) threadId: string,
        @Body(new SchemaValidationPipe(postMessageSchema)) body: PostMessagePayload,
        @Res() res: Response,
    ): Promise<void> {
        const userId = resolveUserId(user);
        // 소유하지 않은 스레드면 SSE 헤더를 쓰기 전에 예외로 착지해 필터가 상태 코드를 낸다.
        await this.appendUserMessage.execute({ userId, threadId, content: body.content });

        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache, no-transform");
        res.setHeader("Connection", "keep-alive");
        res.flushHeaders();

        const abort = new AbortController();
        res.on("close", () => abort.abort());

        const sink: ChatTurnSink = {
            onAssistantDelta: (text) => writeEvent(res, "assistant_delta", { text }),
            onToolCall: (call) => writeEvent(res, "tool_call", call),
            onToolResult: (result) => writeEvent(res, "tool_result", result),
            onConfirmRequest: (request) => writeEvent(res, "tool_confirm_request", request),
            onMemoryUpdated: (update) => writeEvent(res, "memory_updated", update),
        };

        try {
            const { message } = await this.runChatTurn.execute(
                {
                    userId,
                    threadId,
                    abortSignal: abort.signal,
                    ...(body.model !== undefined ? { model: body.model } : {}),
                    ...(body.agentBackend !== undefined ? { agentBackend: body.agentBackend } : {}),
                    ...(body.language !== undefined ? { language: body.language } : {}),
                },
                sink,
            );
            writeEvent(res, "done", { message });
        } catch (error) {
            writeEvent(res, "error", { message: errorMessage(error) });
        } finally {
            res.end();
        }
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

// SSE 프레임은 이벤트 이름과 한 줄 JSON 데이터를 빈 줄로 끊어 보낸다.
function writeEvent(res: Response, event: string, data: unknown): void {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}
