import { Controller, Get, Query } from "@nestjs/common";
import { ListFileAffinityUseCase } from "~tracer-api/domain/affinity/application/query/list.file.affinity.usecase.js";
import { SchemaValidationPipe } from "~tracer-api/support/schema.validation.pipe.js";
import { fileAffinityQuerySchema, type FileAffinityQuery } from "./file.affinity.schema.js";

/** 의도별 파일 접근 친화도 조회 HTTP 계약을 제공한다. */
@Controller("api/v1/file-affinity")
export class FileAffinityController {
    constructor(private readonly listFileAffinity: ListFileAffinityUseCase) {}

    @Get()
    async list(
        @Query(new SchemaValidationPipe(fileAffinityQuerySchema)) query: FileAffinityQuery,
    ) {
        return this.listFileAffinity.execute(query.intent, query.limit);
    }
}
