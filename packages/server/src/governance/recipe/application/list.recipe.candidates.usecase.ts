import { Injectable } from "@nestjs/common";
import { RecipeCandidateRepository } from "../repository/recipe.candidate.repository.js";
import { candidateToDto } from "./recipe.dto.mapper.js";
import type {
    ListRecipeCandidatesUseCaseIn,
    ListRecipeCandidatesUseCaseOut,
} from "./dto/recipe.usecase.dto.js";

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
