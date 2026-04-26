import type { VerdictInsertPortDto } from "~application/ports/verification/verdicts/dto/verdict.insert.port.dto.js";
import type { VerdictReadPort } from "~application/ports/verification/verdicts/verdict.read.port.js";
import type { VerdictWritePort } from "~application/ports/verification/verdicts/verdict.write.port.js";

export type VerdictUpsertInput = VerdictInsertPortDto;

export interface IVerdictRepository extends VerdictReadPort, VerdictWritePort {}
