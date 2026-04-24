import { Module } from "@nestjs/common";
import { RuntimeSessionController } from "~adapters/http/ingest/index.js";
import { ApplicationModule } from "../application/application.module.js";

@Module({
    imports: [ApplicationModule],
    controllers: [RuntimeSessionController],
})
export class SessionsHttpModule {}
