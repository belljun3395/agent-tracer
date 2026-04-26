import type { TurnStatusPortDto } from "./turn.record.port.dto.js";

export interface BackfillTurnPortDto {
    readonly id: string;
    readonly sessionId: string;
    readonly taskId: string;
    readonly status: TurnStatusPortDto;
    readonly assistantText: string;
    readonly userMessageText: string;
}
