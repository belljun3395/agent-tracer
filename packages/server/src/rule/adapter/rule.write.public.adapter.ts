import { Inject, Injectable } from "@nestjs/common";
import { RULE_PERSISTENCE_PORT } from "../application/outbound/tokens.js";
import type { IRulePersistence } from "../application/outbound/rule.persistence.port.js";
import type {
    RuleSnapshot,
    RuleSnapshotInsertInput,
    RuleSnapshotUpdateInput,
} from "../public/dto/rule.snapshot.dto.js";
import type { IRuleWrite } from "../public/iservice/rule.write.iservice.js";

@Injectable()
export class RuleWritePublicAdapter implements IRuleWrite {
    constructor(
        @Inject(RULE_PERSISTENCE_PORT) private readonly persistence: IRulePersistence,
    ) {}

    async insert(input: RuleSnapshotInsertInput): Promise<RuleSnapshot> {
        const record = await this.persistence.insert(input as never);
        return record as unknown as RuleSnapshot;
    }

    async update(id: string, patch: RuleSnapshotUpdateInput, newSignature: string): Promise<RuleSnapshot | null> {
        const record = await this.persistence.update(id, patch as never, newSignature);
        return record as unknown as RuleSnapshot | null;
    }

    softDelete(id: string, deletedAt: string): Promise<boolean> {
        return this.persistence.softDelete(id, deletedAt);
    }
}
