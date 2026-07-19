import { Body, Controller, Delete, Get, Headers, HttpCode, HttpStatus, Param, Patch, Post } from "@nestjs/common";
import { MONITOR_USER_HEADER, TAGS_PATH } from "@monitor/kernel";
import { CreateTagUseCase } from "~tracer-api/domain/tag/application/command/create.tag.usecase.js";
import { DeleteTagUseCase } from "~tracer-api/domain/tag/application/command/delete.tag.usecase.js";
import { UpdateTagUseCase } from "~tracer-api/domain/tag/application/command/update.tag.usecase.js";
import { ListTagsUseCase } from "~tracer-api/domain/tag/application/query/list.tags.usecase.js";
import { pathParamPipe } from "~tracer-api/support/path-param.pipe.js";
import { resolveUserId } from "~tracer-api/support/request-user.js";
import { SchemaValidationPipe } from "~tracer-api/support/schema.validation.pipe.js";
import { createTagSchema, updateTagSchema, type CreateTagPayload, type UpdateTagPayload } from "./tag.schema.js";

/** 태그 조회·생성·수정·삭제 HTTP 계약을 제공한다. */
@Controller(TAGS_PATH)
export class TagController {
    constructor(
        private readonly listTags: ListTagsUseCase,
        private readonly createTag: CreateTagUseCase,
        private readonly updateTag: UpdateTagUseCase,
        private readonly deleteTag: DeleteTagUseCase,
    ) {}

    @Get()
    async list(@Headers(MONITOR_USER_HEADER) user: string | undefined) {
        return this.listTags.execute(resolveUserId(user));
    }

    @Post()
    @HttpCode(HttpStatus.CREATED)
    async create(
        @Headers(MONITOR_USER_HEADER) user: string | undefined,
        @Body(new SchemaValidationPipe(createTagSchema)) body: CreateTagPayload,
    ) {
        return this.createTag.execute({
            userId: resolveUserId(user),
            name: body.name,
            ...(body.color !== undefined ? { color: body.color } : {}),
            ...(body.description !== undefined ? { description: body.description } : {}),
        });
    }

    @Patch(":id")
    async update(
        @Headers(MONITOR_USER_HEADER) user: string | undefined,
        @Param("id", pathParamPipe) id: string,
        @Body(new SchemaValidationPipe(updateTagSchema)) body: UpdateTagPayload,
    ) {
        return this.updateTag.execute({
            userId: resolveUserId(user),
            id,
            ...(body.name !== undefined ? { name: body.name } : {}),
            ...(body.color !== undefined ? { color: body.color } : {}),
            ...(body.description !== undefined ? { description: body.description } : {}),
        });
    }

    @Delete(":id")
    @HttpCode(HttpStatus.OK)
    async remove(
        @Headers(MONITOR_USER_HEADER) user: string | undefined,
        @Param("id", pathParamPipe) id: string,
    ) {
        return this.deleteTag.execute(resolveUserId(user), id);
    }
}
