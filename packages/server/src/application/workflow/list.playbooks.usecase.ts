import type { PlaybookStatus } from "~domain/index.js";
import type { IPlaybookRepository } from "../ports/index.js";

export class ListPlaybooksUseCase {
    constructor(private readonly evaluationRepo: IPlaybookRepository) {}

    async execute(query?: string, status?: PlaybookStatus, limit?: number) {
        return this.evaluationRepo.listPlaybooks(query, status, limit);
    }
}
