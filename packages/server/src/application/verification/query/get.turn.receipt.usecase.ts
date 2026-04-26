import type { ITurnQueryRepository } from "~application/ports/repository/turn.query.repository.js";
import type { TurnReceiptView } from "~domain/verification/index.js";

export class GetTurnReceiptUseCase {
    constructor(private readonly deps: { readonly turnQueryRepo: ITurnQueryRepository }) {}

    async execute(turnId: string): Promise<TurnReceiptView | null> {
        return this.deps.turnQueryRepo.getReceipt(turnId);
    }
}
