import type {
    VerdictInsertPortDto,
    VerdictReadPort,
    VerdictWritePort,
} from "../verification/index.js";

export type VerdictUpsertInput = VerdictInsertPortDto;

export interface IVerdictRepository extends VerdictReadPort, VerdictWritePort {}
