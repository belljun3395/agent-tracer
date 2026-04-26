import { Controller, Get, Inject, Param } from "@nestjs/common";
import { ListBriefingsUseCase } from "~application/workflow/index.js";
import { pathParamPipe } from "~adapters/http/shared/path-param.pipe.js";

@Controller("api/v1/tasks/:id")
export class TaskBriefingQueryController {
    constructor(
        @Inject(ListBriefingsUseCase) private readonly listBriefings: ListBriefingsUseCase,
    ) {}

    @Get("briefings")
    async listBriefingsEndpoint(@Param("id", pathParamPipe) taskId: string) {
        return this.listBriefings.execute({ taskId });
    }
}
