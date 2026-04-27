import { Inject, Injectable } from "@nestjs/common";
import { RULE_PERSISTENCE_PORT } from "../application/outbound/tokens.js";
import type {
    IRulePersistence,
} from "../application/outbound/rule.persistence.port.js";
import type {
    RuleSnapshot,
    RuleSnapshotListFilter,
} from "../public/dto/rule.snapshot.dto.js";
import type { IRuleRead } from "../public/iservice/rule.read.iservice.js";

@Injectable()
export class RuleReadPublicAdapter implements IRuleRead {
    constructor(
        @Inject(RULE_PERSISTENCE_PORT) private readonly persistence: IRulePersistence,
    ) {}

    async findById(id: string): Promise<RuleSnapshot | null> {
        const record = await this.persistence.findById(id);
        return record as unknown as RuleSnapshot | null;
    }

    async list(filter?: RuleSnapshotListFilter): Promise<readonly RuleSnapshot[]> {
        const records = await this.persistence.list(filter as never);
        return records as unknown as readonly RuleSnapshot[];
    }

    async findActiveForTurn(taskId: string): Promise<readonly RuleSnapshot[]> {
        const records = await this.persistence.findActiveForTurn(taskId);
        return records as unknown as readonly RuleSnapshot[];
    }
}
