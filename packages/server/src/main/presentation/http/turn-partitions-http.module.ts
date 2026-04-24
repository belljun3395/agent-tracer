import { Module } from "@nestjs/common";
import { TurnPartitionWriteController } from "~adapters/http/ingest/index.js";
import { TurnPartitionController } from "~adapters/http/query/index.js";
import { ApplicationModule } from "../application/application.module.js";

@Module({
    imports: [ApplicationModule],
    controllers: [
        TurnPartitionController,
        TurnPartitionWriteController,
    ],
})
export class TurnPartitionsHttpModule {}
