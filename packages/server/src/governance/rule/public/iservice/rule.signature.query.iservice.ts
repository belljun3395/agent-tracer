import type { RuleSnapshot } from "../dto/rule.snapshot.dto.js";

/** Public iservice — find a rule by its content signature. */
export interface IRuleSignatureQuery {
    findBySignature(signature: string): Promise<RuleSnapshot | null>;
}
