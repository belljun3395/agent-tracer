import { Body, Controller, Get, Headers, HttpCode, HttpStatus, Post } from "@nestjs/common";
import { MONITOR_USER_HEADER, type DaemonHealthReportPayload } from "@monitor/kernel";
import { daemonHealthReportSchema } from "@monitor/kernel/daemon/daemon.health.schema.js";
import { ReportDaemonHealthUseCase } from "~tracer-api/domain/health/application/command/report.daemon.health.usecase.js";
import { GetDaemonHealthUseCase } from "~tracer-api/domain/health/application/query/get.daemon.health.usecase.js";
import { SchemaValidationPipe } from "~tracer-api/support/schema.validation.pipe.js";
import { resolveUserId } from "~tracer-api/support/request-user.js";

@Controller("api/v1/daemon-health")
export class DaemonHealthController {
    constructor(
        private readonly reportDaemonHealth: ReportDaemonHealthUseCase,
        private readonly getDaemonHealth: GetDaemonHealthUseCase,
    ) {}

    @Post()
    @HttpCode(HttpStatus.OK)
    async report(
        @Headers(MONITOR_USER_HEADER) user: string | undefined,
        @Body(new SchemaValidationPipe(daemonHealthReportSchema)) body: DaemonHealthReportPayload,
    ) {
        return this.reportDaemonHealth.execute(resolveUserId(user), body);
    }

    @Get()
    async get(@Headers(MONITOR_USER_HEADER) user: string | undefined) {
        return this.getDaemonHealth.execute(resolveUserId(user));
    }
}
