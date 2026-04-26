import { Body, Controller, HttpCode, HttpStatus, Inject, NotFoundException, Param, Patch, Post } from "@nestjs/common";
import {
    CreatePlaybookUseCase,
    UpdatePlaybookUseCase,
    type CreatePlaybookUseCaseIn,
    type UpdatePlaybookUseCaseIn,
} from "~application/workflow/index.js";
import {
    playbookPatchSchema,
    playbookUpsertSchema,
} from "~adapters/http/command/schemas/playbook.command.schema.js";
import { pathParamPipe } from "~adapters/http/shared/path-param.pipe.js";
import { ZodValidationPipe } from "~adapters/http/shared/zod-validation.pipe.js";

@Controller("api/v1/playbooks")
export class PlaybookCommandController {
    constructor(
        @Inject(CreatePlaybookUseCase) private readonly createPlaybook: CreatePlaybookUseCase,
        @Inject(UpdatePlaybookUseCase) private readonly updatePlaybook: UpdatePlaybookUseCase,
    ) {}

    @Post()
    @HttpCode(HttpStatus.OK)
    async createPlaybookEndpoint(@Body(new ZodValidationPipe(playbookUpsertSchema)) body: CreatePlaybookUseCaseIn) {
        return this.createPlaybook.execute(buildPlaybookPayload(body));
    }

    @Patch(":id")
    async updatePlaybookEndpoint(
        @Param("id", pathParamPipe) playbookId: string,
        @Body(new ZodValidationPipe(playbookPatchSchema)) body: Omit<UpdatePlaybookUseCaseIn, "playbookId">,
    ) {
        const updated = await this.updatePlaybook.execute({ ...buildPlaybookPatch(body), playbookId });
        if (!updated) throw new NotFoundException("playbook not found");
        return updated;
    }
}

function buildPlaybookPayload(body: CreatePlaybookUseCaseIn): CreatePlaybookUseCaseIn {
    return {
        title: body.title,
        ...(body.status !== undefined ? { status: body.status } : {}),
        ...(body.whenToUse !== undefined ? { whenToUse: body.whenToUse } : {}),
        ...(body.prerequisites !== undefined ? { prerequisites: body.prerequisites } : {}),
        ...(body.approach !== undefined ? { approach: body.approach } : {}),
        ...(body.keySteps !== undefined ? { keySteps: body.keySteps } : {}),
        ...(body.watchouts !== undefined ? { watchouts: body.watchouts } : {}),
        ...(body.antiPatterns !== undefined ? { antiPatterns: body.antiPatterns } : {}),
        ...(body.failureModes !== undefined ? { failureModes: body.failureModes } : {}),
        ...(body.variants !== undefined ? { variants: body.variants } : {}),
        ...(body.relatedPlaybookIds !== undefined ? { relatedPlaybookIds: body.relatedPlaybookIds } : {}),
        ...(body.sourceSnapshotIds !== undefined ? { sourceSnapshotIds: body.sourceSnapshotIds } : {}),
        ...(body.tags !== undefined ? { tags: body.tags } : {}),
    };
}

function buildPlaybookPatch(body: Omit<UpdatePlaybookUseCaseIn, "playbookId">): Omit<UpdatePlaybookUseCaseIn, "playbookId"> {
    return {
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.status !== undefined ? { status: body.status } : {}),
        ...(body.whenToUse !== undefined ? { whenToUse: body.whenToUse } : {}),
        ...(body.prerequisites !== undefined ? { prerequisites: body.prerequisites } : {}),
        ...(body.approach !== undefined ? { approach: body.approach } : {}),
        ...(body.keySteps !== undefined ? { keySteps: body.keySteps } : {}),
        ...(body.watchouts !== undefined ? { watchouts: body.watchouts } : {}),
        ...(body.antiPatterns !== undefined ? { antiPatterns: body.antiPatterns } : {}),
        ...(body.failureModes !== undefined ? { failureModes: body.failureModes } : {}),
        ...(body.variants !== undefined ? { variants: body.variants } : {}),
        ...(body.relatedPlaybookIds !== undefined ? { relatedPlaybookIds: body.relatedPlaybookIds } : {}),
        ...(body.sourceSnapshotIds !== undefined ? { sourceSnapshotIds: body.sourceSnapshotIds } : {}),
        ...(body.tags !== undefined ? { tags: body.tags } : {}),
    };
}
