import { Controller, Patch, Body, Param, HttpException, HttpStatus, Inject } from "@nestjs/common";
import { UpdateEventUseCase } from "~application/events/index.js";
import type { EventPatchInput } from "~application/events/index.js";
import { eventPatchSchema } from "../schemas/event.write.schema.js";
import { ZodValidationPipe } from "~adapters/http/shared/zod-validation.pipe.js";

@Controller()
export class EventController {
    constructor(@Inject(UpdateEventUseCase) private readonly updateEvent: UpdateEventUseCase) {}

    @Patch("/api/events/:eventId")
    async patchEvent(
        @Param("eventId") eventId: string,
        @Body(new ZodValidationPipe(eventPatchSchema)) body: Omit<EventPatchInput, "eventId">,
    ) {
        const event = await this.updateEvent.execute({
            eventId: eventId,
            ...(body.displayTitle !== undefined ? { displayTitle: body.displayTitle } : {})
        } satisfies EventPatchInput);
        if (!event) {
            throw new HttpException({ error: "Event not found" }, HttpStatus.NOT_FOUND);
        }
        return { event };
    }
}
