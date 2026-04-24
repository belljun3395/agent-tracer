import { Module } from "@nestjs/common";
import {
    TURN_PARTITIONS_APPLICATION_EXPORTS,
    TURN_PARTITIONS_APPLICATION_PROVIDERS,
} from "./turn-partitions.providers.js";

@Module({
    providers: TURN_PARTITIONS_APPLICATION_PROVIDERS,
    exports: [...TURN_PARTITIONS_APPLICATION_EXPORTS],
})
export class TurnPartitionsApplicationModule {}
