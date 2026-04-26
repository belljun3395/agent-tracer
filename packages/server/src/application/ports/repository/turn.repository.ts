import type { TurnInsertPortDto } from "~application/ports/verification/turns/dto/turn.insert.port.dto.js";
import type { TurnRecordPortDto, TurnStatusPortDto } from "~application/ports/verification/turns/dto/turn.record.port.dto.js";
import type { TurnReadPort } from "~application/ports/verification/turns/turn.read.port.js";
import type { TurnWritePort } from "~application/ports/verification/turns/turn.write.port.js";

export type TurnStatus = TurnStatusPortDto;
export type TurnInsertInput = TurnInsertPortDto;
export type StoredTurn = TurnRecordPortDto;

export interface ITurnRepository extends TurnReadPort, TurnWritePort {}
