import type {
    TurnInsertPortDto,
    TurnReadPort,
    TurnRecordPortDto,
    TurnStatusPortDto,
    TurnWritePort,
} from "../verification/index.js";

export type TurnStatus = TurnStatusPortDto;
export type TurnInsertInput = TurnInsertPortDto;
export type StoredTurn = TurnRecordPortDto;

export interface ITurnRepository extends TurnReadPort, TurnWritePort {}
