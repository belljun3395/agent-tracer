import { Controller, Patch, Body, Param, NotFoundException, Inject } from "@nestjs/common";
import { UpdateEventUseCase } from "~application/events/index.js";
import type { UpdateEventUseCaseIn } from "~application/events/index.js";
import { eventPatchSchema } from "../schemas/event.write.schema.js";
import { pathParamPipe } from "~adapters/http/shared/path-param.pipe.js";
import { ZodValidationPipe } from "~adapters/http/shared/zod-validation.pipe.js";

@Controller("api/events")
export class EventController {
    constructor(@Inject(UpdateEventUseCase) private readonly updateEvent: UpdateEventUseCase) {}

    @Patch(":eventId")
    async patchEvent(
        @Param("eventId", pathParamPipe) eventId: string,
        @Body(new ZodValidationPipe(eventPatchSchema)) body: Omit<UpdateEventUseCaseIn, "eventId">,
    ) {
        const input = {
            eventId,
            ...(body.displayTitle !== undefined ? { displayTitle: body.displayTitle } : {}),
        } satisfies UpdateEventUseCaseIn;
        const event = await this.updateEvent.execute(input);
        if (!event) {
            throw new NotFoundException("Event not found");
        }
        return { event };
    }
}
