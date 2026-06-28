import { Injectable } from "@nestjs/common";
import { Transactional } from "typeorm-transactional";
import { RecipeCandidateRepository } from "../repository/recipe.candidate.repository.js";
import type {
    DismissRecipeCandidateUseCaseIn,
    DismissRecipeCandidateUseCaseOut,
} from "./dto/dismiss.recipe.candidate.usecase.dto.js";

@Injectable()
export class DismissRecipeCandidateUseCase {
    constructor(private readonly candidates: RecipeCandidateRepository) {}

    @Transactional()
    async execute(
        input: DismissRecipeCandidateUseCaseIn,
    ): Promise<DismissRecipeCandidateUseCaseOut> {
        const row = await this.candidates.findById(input.candidateId);
        if (!row) return { status: "not_found" };
        if (!row.isPending()) return { status: "not_pending" };
        await this.candidates.markResolved({
            id: row.id,
            status: "dismissed",
            resolvedAt: new Date().toISOString(),
        });
        return { status: "dismissed" };
    }
}
