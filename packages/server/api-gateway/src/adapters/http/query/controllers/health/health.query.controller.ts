import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource } from "typeorm";
import { NoEnvelope } from "@monitor/shared/contracts/http/no-envelope.decorator.js";

@Controller("health")
@NoEnvelope()
export class HealthController {
    constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

    // liveness는 프로세스 생존만 판단해 일시적 의존성 장애로 재시작되지 않게 한다.
    @Get()
    health() {
        return { ok: true };
    }

    // readiness는 요청을 받을 수 있는지 판단하므로 Postgres 연결까지 확인한다.
    @Get("ready")
    async ready(): Promise<{ readonly ok: true; readonly checks: Record<string, "up"> }> {
        const checks: Record<string, "up" | "down"> = {};
        try {
            await this.dataSource.query("SELECT 1");
            checks.postgres = "up";
        } catch {
            checks.postgres = "down";
        }

        const ready = Object.values(checks).every((status) => status === "up");
        if (!ready) {
            throw new ServiceUnavailableException({ ok: false, checks });
        }
        return { ok: true, checks: checks as Record<string, "up"> };
    }
}
