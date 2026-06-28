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
} from "./dto/accept.recipe.candidate.usecase.dto.js";

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
        // 존재하지 않는 후보는 적용 대상이 아니므로 not_found로 끝낸다.
        if (!row) return { status: "not_found" };
        // pending 후보만 레시피로 승격할 수 있다.
        if (!row.isPending()) return { status: "not_pending" };

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

        if (row.parentRecipeId) {
            // 사용자가 새 개정을 수락한 경우에만 부모 레시피를 superseded로 전환한다.
            await this.recipes.setStatus(row.parentRecipeId, "superseded", now);
        }

        await this.candidates.markResolved({
            id: row.id,
            status: "accepted",
            resolvedAt: now,
        });

        await this.populateFileAffinity(row.intent, row.touchedFilesJson, now);

        return { status: "accepted", recipeId };
    }

    private async populateFileAffinity(
        intent: string,
        touchedFilesJson: string,
        lastSeenAt: string,
    ): Promise<void> {
        const parsed = safeJsonParse(touchedFilesJson);
        // 파일 정보가 배열이 아니면 affinity를 만들 근거가 없어 건너뛴다.
        if (!Array.isArray(parsed)) return;
        for (const item of parsed) {
            if (!item || typeof item !== "object") continue;
            const rec = item as Record<string, unknown>;
            if (typeof rec.path !== "string") continue;
            const role = rec.role;
            // read/write/both로 판정 가능한 파일만 intent affinity에 반영한다.
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
        // 부모가 없으면 새 계열의 첫 rev가 되도록 0에서 시작한다.
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
