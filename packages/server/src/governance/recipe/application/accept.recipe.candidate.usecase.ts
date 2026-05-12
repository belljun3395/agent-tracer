import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { Transactional } from "typeorm-transactional";
import type { FileAffinityRole } from "../domain/file.affinity.entity.js";
import { FileAffinityRepository } from "../repository/file.affinity.repository.js";
import { RecipeCandidateRepository } from "../repository/recipe.candidate.repository.js";
import { RecipeRepository } from "../repository/recipe.repository.js";
import type {
    AcceptRecipeCandidateUseCaseIn,
    AcceptRecipeCandidateUseCaseOut,
} from "./dto/recipe.usecase.dto.js";

@Injectable()
export class AcceptRecipeCandidateUseCase {
    constructor(
        private readonly candidates: RecipeCandidateRepository,
        private readonly recipes: RecipeRepository,
        private readonly fileAffinity: FileAffinityRepository,
    ) {}

    @Transactional()
    async execute(
        input: AcceptRecipeCandidateUseCaseIn,
    ): Promise<AcceptRecipeCandidateUseCaseOut> {
        const row = await this.candidates.findById(input.candidateId);
        if (!row) return { status: "not_found" };
        if (row.status !== "pending") return { status: "not_pending" };

        const now = new Date().toISOString();

        const parentRev = await this.computeRev(row.parentRecipeId);
        const recipeId = randomUUID();
        await this.recipes.insert({
            id: recipeId,
            sourceCandidateId: row.id,
            title: row.title,
            intent: row.intent,
            description: row.description,
            summaryMd: row.summaryMd,
            stepsJson: row.stepsJson,
            touchedFilesJson: row.touchedFilesJson,
            contributingSlicesJson: row.contributingSlicesJson,
            rev: parentRev + 1,
            parentRecipeId: row.parentRecipeId,
            language: row.language,
            createdAt: now,
        });

        // Supersede the parent — only when the user explicitly accepts the
        // new revision. Auto-supersede never happens.
        if (row.parentRecipeId) {
            await this.recipes.setStatus(row.parentRecipeId, "superseded", now);
        }

        await this.candidates.markResolved({
            id: row.id,
            status: "accepted",
            resolvedAt: now,
        });

        // Populate file_affinity_summary from the recipe's touched_files —
        // the LLM already identified which files matter for this intent.
        await this.populateFileAffinity(row.intent, row.touchedFilesJson, now);

        return { status: "accepted", recipeId };
    }

    private async populateFileAffinity(
        intent: string,
        touchedFilesJson: string,
        lastSeenAt: string,
    ): Promise<void> {
        const parsed = safeJsonParse(touchedFilesJson);
        if (!Array.isArray(parsed)) return;
        for (const item of parsed) {
            if (!item || typeof item !== "object") continue;
            const rec = item as Record<string, unknown>;
            if (typeof rec.path !== "string") continue;
            const role = rec.role;
            if (role !== "read" && role !== "write" && role !== "both") continue;
            await this.fileAffinity.upsertIncrement({
                filePath: rec.path,
                intentLabel: intent,
                role: role as FileAffinityRole,
                lastSeenAt,
            });
        }
    }

    private async computeRev(parentRecipeId: string | null): Promise<number> {
        if (!parentRecipeId) return 0;
        const parent = await this.recipes.findById(parentRecipeId);
        return parent?.rev ?? 0;
    }
}

function safeJsonParse(raw: string): unknown {
    try {
        return JSON.parse(raw);
    } catch {
        return null;
    }
}
