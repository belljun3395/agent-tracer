import { Module } from "@nestjs/common";
import { MonitorServiceProvider } from "./monitor-service.provider.js";
import { DatabaseModule } from "../database/database.module.js";
@Module({
    imports: [DatabaseModule],
    providers: [MonitorServiceProvider],
    exports: [MonitorServiceProvider]
})
export class ServiceModule {
}
