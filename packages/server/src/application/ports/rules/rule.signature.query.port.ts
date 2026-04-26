import type { RuleRecordPortDto } from "./dto/rule.record.port.dto.js";

export interface RuleSignatureQueryPort {
    findBySignature(signature: string): Promise<RuleRecordPortDto | null>;
}
