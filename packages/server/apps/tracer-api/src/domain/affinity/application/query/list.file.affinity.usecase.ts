import { Inject, Injectable } from "@nestjs/common";
import {
    FILE_AFFINITY_REPOSITORY,
    type FileAffinityRepositoryPort,
} from "~tracer-api/domain/affinity/port/file.affinity.repository.port.js";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export interface FileAffinityItem {
    readonly filePath: string;
    readonly role: string;
    readonly openCount: number;
    readonly lastSeenAt: string;
}

/** 의도별 파일 접근 친화도 조회를 제공한다. */
@Injectable()
export class ListFileAffinityUseCase {
    constructor(
        @Inject(FILE_AFFINITY_REPOSITORY)
        private readonly fileAffinity: FileAffinityRepositoryPort,
    ) {}

    async execute(
        intent: string | undefined,
        limit: number | undefined,
    ): Promise<{ readonly intent: string | null; readonly items: readonly FileAffinityItem[] }> {
        const label = intent?.trim();
        if (label === undefined || label.length === 0) return { intent: null, items: [] };
        const rows = await this.fileAffinity.findByIntent(label, clampLimit(limit));
        return {
            intent: label,
            items: rows.map((row) => ({
                filePath: row.filePath,
                role: row.role,
                openCount: row.openCount,
                lastSeenAt: row.lastSeenAt.toISOString(),
            })),
        };
    }
}

function clampLimit(raw: number | undefined): number {
    if (raw === undefined || !Number.isFinite(raw) || raw <= 0) return DEFAULT_LIMIT;
    return Math.min(Math.floor(raw), MAX_LIMIT);
}
