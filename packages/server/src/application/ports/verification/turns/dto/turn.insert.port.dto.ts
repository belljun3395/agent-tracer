import type { TurnStatusPortDto } from "./turn.record.port.dto.js";

export interface TurnInsertPortDto {
    readonly id: string;
    readonly sessionId: string;
    readonly taskId: string;
    readonly turnIndex: number;
    readonly status: TurnStatusPortDto;
    readonly startedAt: string;
    readonly askedText?: string | null;
}
