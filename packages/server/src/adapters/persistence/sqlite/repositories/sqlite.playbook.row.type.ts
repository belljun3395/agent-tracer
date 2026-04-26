import type { PlaybookRecord, PlaybookStatus, PlaybookSummary } from "~domain/workflow/index.js";
import { parseJsonField } from "../shared/sqlite.json";

export interface PlaybookRow {
    id: string;
    title: string;
    slug: string;
    status: string;
    when_to_use: string | null;
    prerequisites: string | null;
    approach: string | null;
    key_steps: string | null;
    watchouts: string | null;
    anti_patterns: string | null;
    failure_modes: string | null;
    variants: string | null;
    related_playbook_ids: string | null;
    source_snapshot_ids: string | null;
    tags: string | null;
    search_text: string | null;
    embedding: string | null;
    embedding_model: string | null;
    use_count: number;
    last_used_at: string | null;
    created_at: string;
    updated_at: string;
}

export interface RankedPlaybookRow {
    readonly row: PlaybookRow;
    readonly lexicalScore: number;
    readonly semanticScore: number | null;
}

export function parseJsonList(raw: string | null | undefined): readonly string[] {
    return raw ? parseJsonField<string[]>(raw) : [];
}

export function mapPlaybookSummary(row: PlaybookRow): PlaybookSummary {
    return {
        layer: "playbook",
        id: row.id,
        title: row.title,
        slug: row.slug,
        status: row.status as PlaybookStatus,
        whenToUse: row.when_to_use,
        tags: parseJsonList(row.tags),
        useCount: row.use_count,
        lastUsedAt: row.last_used_at,
        sourceSnapshotIds: parseJsonList(row.source_snapshot_ids),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

export function mapPlaybookRecord(row: PlaybookRow): PlaybookRecord {
    return {
        ...mapPlaybookSummary(row),
        prerequisites: parseJsonList(row.prerequisites),
        approach: row.approach,
        keySteps: parseJsonList(row.key_steps),
        watchouts: parseJsonList(row.watchouts),
        antiPatterns: parseJsonList(row.anti_patterns),
        failureModes: parseJsonList(row.failure_modes),
        variants: row.variants ? parseJsonField<PlaybookRecord["variants"]>(row.variants) : [],
        relatedPlaybookIds: parseJsonList(row.related_playbook_ids),
        searchText: row.search_text,
    };
}
