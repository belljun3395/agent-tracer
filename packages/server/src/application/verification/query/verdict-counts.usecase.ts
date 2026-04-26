import type { IVerdictRepository } from "~application/ports/repository/verdict.repository.js";

export interface VerdictCounts {
    readonly contradicted: number;
}

export interface VerdictCountsInput {
    readonly sessionId?: string;
}

export interface VerdictCountsDeps {
    readonly verdictRepo: IVerdictRepository;
}

export class VerdictCountsUseCase {
    constructor(private readonly deps: VerdictCountsDeps) {}

    async execute(input: VerdictCountsInput = {}): Promise<VerdictCounts> {
        const { verdictRepo } = this.deps;
        const contradicted = input.sessionId
            ? await verdictRepo.countUnacknowledgedContradicted(input.sessionId)
            : 0;
        return { contradicted };
    }
}
