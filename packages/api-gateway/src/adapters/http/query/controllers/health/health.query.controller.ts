import { Controller, Get } from "@nestjs/common";
import { NoEnvelope } from "@monitor/shared/contracts/http/no-envelope.decorator.js";

@Controller("health")
@NoEnvelope()
export class HealthController {
    @Get()
    health() {
        return { ok: true };
    }
}
