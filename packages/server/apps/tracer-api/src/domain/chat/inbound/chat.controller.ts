import { Body, Controller, Delete, Get, Headers, HttpCode, HttpStatus, Param, Patch, Post, Res } from "@nestjs/common";
import type { Response } from "express";
import { CHAT_THREADS_PATH, MONITOR_USER_HEADER } from "@monitor/kernel";
import { errorMessage } from "@monitor/llm-runtime";
import { CHAT_SPEC } from "~tracer-api/domain/chat/model/chat.spec.js";
import { SseWriter } from "./chat.sse.writer.js";
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
        // 앞단 리버스 프록시(nginx 등)가 기본 proxy_buffering으로 스트림을 모아 두면 토큰이 실시간으로 못 나가므로, 이 응답만 버퍼링을 끄게 지시한다.
        res.setHeader("X-Accel-Buffering", "no");
        res.flushHeaders();

        const abort = new AbortController();
        const writer = new SseWriter(res);
        const guard = new TurnTimeout(() => this.expire(abort, writer, res));
        // 소켓이 닫히면 상류 실행을 끊고, 역압력으로 drain을 기다리던 쓰기도 함께 깨운다.
        res.on("close", () => {
            abort.abort();
            writer.close();
            guard.clear();
        });

        const sink: ChatTurnSink = {
            onAssistantDelta: (text) => {
                guard.bump();
                return writer.write("assistant_delta", { text });
            },
            onToolCall: (call) => writer.write("tool_call", call),
            onToolResult: (result) => writer.write("tool_result", result),
            onConfirmRequest: (request) => writer.write("tool_confirm_request", request),
            onMemoryUpdated: (update) => writer.write("memory_updated", update),
        };

        guard.bump();
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
            await writer.write("done", { message });
        } catch (error) {
            await writer.write("error", { message: errorMessage(error) });
        } finally {
            guard.clear();
            res.end();
        }
    }

    // 상류가 유휴·전체 상한을 넘기면 실행을 끊고 오류 프레임을 낸 뒤 스트림을 닫는다.
    private expire(abort: AbortController, writer: SseWriter, res: Response): void {
        abort.abort();
        void writer.write("error", { message: "chat turn timed out" });
        res.end();
        writer.close();
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

// delta 사이 유휴 상한이며, 이 안에 어떤 산출도 없으면 상류가 멈춘 것으로 본다.
const CHAT_SSE_IDLE_TIMEOUT_MS = 60_000;
// 한 턴 전체의 상한이며, 상류가 데드라인을 넘겨도 스트림이 무한정 열려 있지 않게 한다.
const CHAT_SSE_TURN_TIMEOUT_MS = CHAT_SPEC.limits.deadlineMs + 10_000;

/** 유휴 타이머와 전체 상한 타이머를 함께 쥐고, 어느 쪽이 터지든 한 번만 만료를 부른다. */
class TurnTimeout {
    private idle: ReturnType<typeof setTimeout> | null = null;
    private readonly total: ReturnType<typeof setTimeout>;
    private fired = false;

    constructor(private readonly onExpire: () => void) {
        this.total = setTimeout(() => this.fire(), CHAT_SSE_TURN_TIMEOUT_MS);
    }

    /** 산출이 흐를 때마다 유휴 타이머를 처음부터 다시 잰다. */
    bump(): void {
        if (this.fired) return;
        if (this.idle !== null) clearTimeout(this.idle);
        this.idle = setTimeout(() => this.fire(), CHAT_SSE_IDLE_TIMEOUT_MS);
    }

    clear(): void {
        this.fired = true;
        if (this.idle !== null) clearTimeout(this.idle);
        clearTimeout(this.total);
    }

    private fire(): void {
        if (this.fired) return;
        this.clear();
        this.onExpire();
    }
}
