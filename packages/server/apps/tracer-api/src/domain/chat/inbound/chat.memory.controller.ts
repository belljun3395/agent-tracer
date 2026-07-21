import { Body, Controller, Get, Headers, HttpCode, HttpStatus, Param, Put } from "@nestjs/common";
import { CHAT_MEMORY_PATH, MONITOR_USER_HEADER } from "@monitor/kernel";
import { pathParamPipe } from "~tracer-api/support/path-param.pipe.js";
import { resolveUserId } from "~tracer-api/support/request-user.js";
import { SchemaValidationPipe } from "~tracer-api/support/schema.validation.pipe.js";
import { ListUserMemoriesUseCase } from "~tracer-api/domain/chat/application/query/list.user.memories.usecase.js";
import { UpsertUserMemoryUseCase } from "~tracer-api/domain/chat/application/command/upsert.user.memory.usecase.js";
import { upsertMemorySchema, type UpsertMemoryPayload } from "./chat.schema.js";

/** LangGraph 백엔드의 저장소가 사용자 장기기억을 사용자 범위로 읽고 쓰는 HTTP 계약을 제공한다. */
@Controller(CHAT_MEMORY_PATH)
export class ChatMemoryController {
    constructor(
        private readonly listMemories: ListUserMemoriesUseCase,
        private readonly upsertMemory: UpsertUserMemoryUseCase,
    ) {}

    @Get()
    async list(@Headers(MONITOR_USER_HEADER) user: string | undefined) {
        return this.listMemories.execute(resolveUserId(user));
    }

    @Put(":key")
    @HttpCode(HttpStatus.OK)
    async upsert(
        @Headers(MONITOR_USER_HEADER) user: string | undefined,
        @Param("key", pathParamPipe) key: string,
        @Body(new SchemaValidationPipe(upsertMemorySchema)) body: UpsertMemoryPayload,
    ) {
        return this.upsertMemory.execute({ userId: resolveUserId(user), key, content: body.content });
    }
}
