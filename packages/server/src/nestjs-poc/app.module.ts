import { Module } from "@nestjs/common";
import { HealthController } from "./health.controller.js";
import { DatabaseProvider } from "./database.provider.js";

@Module({
  controllers: [HealthController],
  providers: [DatabaseProvider],
})
export class AppModule {}
