import { Module } from "@nestjs/common";
import { TurnPartitionWriteController } from "~adapters/http/ingest/index.js";
import { TurnPartitionController } from "~adapters/http/query/index.js";
import { TurnPartitionsApplicationModule } from "../application/turn-partitions-application.module.js";

@Module({
    imports: [TurnPartitionsApplicationModule],
    controllers: [
        TurnPartitionController,
        TurnPartitionWriteController,
    ],
})
export class TurnPartitionsHttpModule {}
