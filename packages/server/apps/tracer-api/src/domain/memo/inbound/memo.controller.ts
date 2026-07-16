import { Body, Controller, Delete, Get, Headers, HttpCode, HttpStatus, Param, Patch, Post, Query } from "@nestjs/common";
import { MEMOS_PATH, MONITOR_USER_HEADER } from "@monitor/kernel";
import { CreateMemoUseCase } from "~tracer-api/domain/memo/application/command/create.memo.usecase.js";
import { DeleteMemoUseCase } from "~tracer-api/domain/memo/application/command/delete.memo.usecase.js";
import { UpdateMemoUseCase } from "~tracer-api/domain/memo/application/command/update.memo.usecase.js";
import { GetMemosByTaskUseCase } from "~tracer-api/domain/memo/application/query/get.memos.by.task.usecase.js";
import { ListMemosUseCase } from "~tracer-api/domain/memo/application/query/list.memos.usecase.js";
import { pathParamPipe } from "~tracer-api/support/path-param.pipe.js";
import { resolveUserId } from "~tracer-api/support/request-user.js";
import { SchemaValidationPipe } from "~tracer-api/support/schema.validation.pipe.js";
import {
    createMemoSchema,
    listMemosQuerySchema,
    updateMemoSchema,
    type CreateMemoPayload,
    type ListMemosQuery,
    type UpdateMemoPayload,
} from "./memo.schema.js";

/** 메모 조회·생성·수정·삭제 HTTP 계약을 제공한다. */
@Controller(MEMOS_PATH)
export class MemoController {
    constructor(
        private readonly listMemos: ListMemosUseCase,
        private readonly getMemosByTask: GetMemosByTaskUseCase,
        private readonly createMemo: CreateMemoUseCase,
        private readonly updateMemo: UpdateMemoUseCase,
        private readonly deleteMemo: DeleteMemoUseCase,
    ) {}

    @Get()
    async list(
        @Headers(MONITOR_USER_HEADER) user: string | undefined,
        @Query(new SchemaValidationPipe(listMemosQuerySchema)) query: ListMemosQuery,
    ) {
        const userId = resolveUserId(user);
        if (query.taskId === undefined) return this.listMemos.execute(userId);
        return this.getMemosByTask.execute(userId, query.taskId, query.eventId);
    }

    @Post()
    @HttpCode(HttpStatus.CREATED)
    async create(
        @Headers(MONITOR_USER_HEADER) user: string | undefined,
        @Body(new SchemaValidationPipe(createMemoSchema)) body: CreateMemoPayload,
    ) {
        return this.createMemo.execute({
            userId: resolveUserId(user),
            taskId: body.taskId,
            body: body.body,
            author: body.author,
            ...(body.eventId !== undefined ? { eventId: body.eventId } : {}),
        });
    }

    @Patch(":id")
    async update(
        @Headers(MONITOR_USER_HEADER) user: string | undefined,
        @Param("id", pathParamPipe) id: string,
        @Body(new SchemaValidationPipe(updateMemoSchema)) body: UpdateMemoPayload,
    ) {
        return this.updateMemo.execute({ userId: resolveUserId(user), id, body: body.body });
    }

    @Delete(":id")
    @HttpCode(HttpStatus.OK)
    async remove(
        @Headers(MONITOR_USER_HEADER) user: string | undefined,
        @Param("id", pathParamPipe) id: string,
    ) {
        return this.deleteMemo.execute(resolveUserId(user), id);
    }
}
