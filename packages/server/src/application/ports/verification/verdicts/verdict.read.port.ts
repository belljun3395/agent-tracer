import type { VerdictRecordPortDto, VerdictStatusPortDto } from "./dto/verdict.record.port.dto.js";

export interface VerdictReadPort {
    findByTurnId(turnId: string): Promise<readonly VerdictRecordPortDto[]>;
    countBySessionAndStatus(sessionId: string, status: VerdictStatusPortDto): Promise<number>;
}
