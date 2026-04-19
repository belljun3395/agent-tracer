import { Controller, Patch, Body, Param, HttpException, HttpStatus, Inject } from "@nestjs/common";
import { UpdateEventUseCase } from "~application/events/index.js";
import type { EventPatchInput } from "~application/events/index.js";
import { eventPatchSchema } from "../schemas/event.write.schema.js";

@Controller()
export class EventController {
    constructor(@Inject(UpdateEventUseCase) private readonly updateEvent: UpdateEventUseCase) {}

    @Patch("/api/events/:eventId")
    async patchEvent(
        @Param("eventId") eventId: string,
        @Body() body: unknown
    ) {
        const parsed = eventPatchSchema.parse(body) as { displayTitle?: string | null };
        const event = await this.updateEvent.execute({
            eventId: eventId,
            ...(parsed.displayTitle !== undefined ? { displayTitle: parsed.displayTitle } : {})
        } satisfies EventPatchInput);
        if (!event) {
            throw new HttpException({ error: "Event not found" }, HttpStatus.NOT_FOUND);
        }
        return { event };
    }
}
