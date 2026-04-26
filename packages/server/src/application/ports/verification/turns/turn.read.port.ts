import type { TurnRecordPortDto } from "./dto/turn.record.port.dto.js";

export interface TurnReadPort {
    findById(turnId: string): Promise<TurnRecordPortDto | null>;
    findOpenBySessionId(sessionId: string): Promise<TurnRecordPortDto | null>;
    countBySessionId(sessionId: string): Promise<number>;
    findEventsForTurn(turnId: string): Promise<readonly string[]>;
}
