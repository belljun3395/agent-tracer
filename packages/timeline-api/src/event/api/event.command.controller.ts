import { Body, Controller, NotFoundException, Param, Patch } from "@nestjs/common";
import { pathParamPipe } from "@monitor/shared/contracts/http/path-param.pipe.js";
import { ZodValidationPipe } from "@monitor/shared/contracts/http/zod-validation.pipe.js";
import { UpdateEventUseCase } from "../application/update.event.usecase.js";
import { eventPatchSchema, EventPatchDto } from "./event.command.schema.js";

// Event mutation that isn't ingest. Recording goes through the typed ingest
// plane (ingest/v1/{tool-activity,workflow,...}); this only patches an
// already-recorded event.
@Controller("api/v1/events")
export class EventCommandController {
    constructor(
        private readonly updateEvent: UpdateEventUseCase,
    ) {}

    @Patch(":eventId")
    async patchEvent(
        @Param("eventId", pathParamPipe) eventId: string,
        @Body(new ZodValidationPipe(eventPatchSchema)) body: EventPatchDto,
    ) {
        const event = await this.updateEvent.execute({
            eventId,
            ...(body.displayTitle !== undefined ? { displayTitle: body.displayTitle } : {}),
        });
        if (!event) throw new NotFoundException("Event not found");
        return { event };
    }
}
