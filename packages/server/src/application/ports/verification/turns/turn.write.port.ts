import type { TurnInsertPortDto } from "./dto/turn.insert.port.dto.js";
import type { TurnAggregateVerdictPortDto, TurnRecordPortDto } from "./dto/turn.record.port.dto.js";

export interface TurnWritePort {
    insert(input: TurnInsertPortDto): Promise<TurnRecordPortDto>;
    linkEvents(turnId: string, eventIds: readonly string[]): Promise<void>;
    closeTurn(turnId: string, assistantText: string, endedAt: string): Promise<void>;
    forceCloseTurn(turnId: string, endedAt: string): Promise<void>;
    updateAggregateVerdict(turnId: string, verdict: TurnAggregateVerdictPortDto): Promise<void>;
    updateRulesEvaluatedCount(turnId: string, count: number): Promise<void>;
}
