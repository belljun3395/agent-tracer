import { Module } from "@nestjs/common";
import { RuntimeSessionController } from "~adapters/http/ingest/index.js";
import { SessionsApplicationModule } from "../application/sessions-application.module.js";

@Module({
    imports: [SessionsApplicationModule],
    controllers: [RuntimeSessionController],
})
export class SessionsHttpModule {}
