import { Controller, Get } from "@nestjs/common";
import { NoEnvelope } from "~main/presentation/decorators/index.js";

@Controller("health")
@NoEnvelope()
export class HealthController {
    @Get()
    health() {
        return { ok: true };
    }
}
