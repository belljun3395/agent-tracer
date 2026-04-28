import { Inject, Injectable } from "@nestjs/common";
import { RULE_PERSISTENCE_PORT } from "../application/outbound/tokens.js";
import type { IRulePersistence } from "../application/outbound/rule.persistence.port.js";
import type { RuleSnapshot } from "../public/dto/rule.snapshot.dto.js";
import type { IRuleSignatureQuery } from "../public/iservice/rule.signature.query.iservice.js";

@Injectable()
export class RuleSignatureQueryPublicAdapter implements IRuleSignatureQuery {
    constructor(
        @Inject(RULE_PERSISTENCE_PORT) private readonly persistence: IRulePersistence,
    ) {}

    async findBySignature(signature: string): Promise<RuleSnapshot | null> {
        const record = await this.persistence.findBySignature(signature);
        return record as unknown as RuleSnapshot | null;
    }
}
