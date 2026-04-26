import { Controller, Get, Inject, NotFoundException, Param, Query } from "@nestjs/common";
import {
    GetPlaybookUseCase,
    ListPlaybooksUseCase,
} from "~application/workflow/index.js";
import {
    playbookListQuerySchema,
    type PlaybookListQuery,
} from "~adapters/http/query/schemas/playbook.query.schema.js";
import { pathParamPipe } from "~adapters/http/shared/path-param.pipe.js";
import { ZodValidationPipe } from "~adapters/http/shared/zod-validation.pipe.js";

@Controller("api/v1/playbooks")
export class PlaybookQueryController {
    constructor(
        @Inject(ListPlaybooksUseCase) private readonly listPlaybooks: ListPlaybooksUseCase,
        @Inject(GetPlaybookUseCase) private readonly getPlaybook: GetPlaybookUseCase,
    ) {}

    @Get()
    async listPlaybooksEndpoint(@Query(new ZodValidationPipe(playbookListQuerySchema)) query: PlaybookListQuery) {
        return this.listPlaybooks.execute({ query: query.q, status: query.status, limit: query.limit });
    }

    @Get(":id")
    async getPlaybookEndpoint(@Param("id", pathParamPipe) playbookId: string) {
        const playbook = await this.getPlaybook.execute({ playbookId });
        if (!playbook) throw new NotFoundException("playbook not found");
        return playbook;
    }
}
