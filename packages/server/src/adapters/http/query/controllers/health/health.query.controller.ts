import { Controller, Get } from "@nestjs/common";
import { NoEnvelope } from "~adapters/http/shared/no-envelope.decorator.js";

@Controller("health")
@NoEnvelope()
export class HealthController {
    @Get()
    health() {
        return { ok: true };
    }
}
