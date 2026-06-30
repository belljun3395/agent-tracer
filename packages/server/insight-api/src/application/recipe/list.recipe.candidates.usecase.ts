import { Injectable } from "@nestjs/common";
import { RecipeCandidateRepository } from "@monitor/insight-api/repository/recipe/recipe.candidate.repository.js";
import { candidateToDto } from "@monitor/insight-api/application/recipe/dto/recipe.dto.mapper.js";
import type {
    ListRecipeCandidatesUseCaseIn,
    ListRecipeCandidatesUseCaseOut,
} from "@monitor/insight-api/application/recipe/dto/list.recipe.candidates.usecase.dto.js";

@Injectable()
export class ListRecipeCandidatesUseCase {
    constructor(private readonly candidates: RecipeCandidateRepository) {}

    async execute(
        input: ListRecipeCandidatesUseCaseIn,
    ): Promise<ListRecipeCandidatesUseCaseOut> {
        const scope = input.status ?? "pending";
        const rows =
            scope === "pending"
                ? await this.candidates.listByStatus("pending")
                : await this.candidates.listAll();
        return { candidates: rows.map(candidateToDto) };
    }
}
