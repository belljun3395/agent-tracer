import type Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import type { IPlaybookRepository, PlaybookUpsertInput } from "~application/ports/index.js";
import type { IEmbeddingService } from "~application/ports/service/embedding.service.js";
import type { PlaybookRecord, PlaybookStatus, PlaybookSummary } from "~domain/workflow/index.js";
import { cosineSimilarity, deserializeEmbedding, serializeEmbedding } from "../shared/embedding.codec.js";
import { normalizeEmbeddingSection, normalizeSearchText } from "../shared/text.normalizers.js";
import { ensureSqliteDatabase, type SqliteDatabaseInput } from "../shared/drizzle.db.js";
import { appendDomainEvent, eventTimeFromIso } from "../events/index.js";
import { upsertSearchDocument } from "../search/sqlite.search.documents.js";
import { type PlaybookRow, type RankedPlaybookRow, mapPlaybookRecord, mapPlaybookSummary, parseJsonList } from "./sqlite.playbook.row.type.js";

const MIN_SEMANTIC_SCORE = 0.22;

type SnapshotReference = { readonly taskId: string; readonly scopeKey: string };

interface PlaybookCoreRow {
    readonly id: string;
    readonly title: string;
    readonly slug: string;
    readonly status: string;
    readonly when_to_use: string | null;
    readonly approach: string | null;
    readonly use_count: number;
    readonly last_used_at: string | null;
    readonly created_at: string;
    readonly updated_at: string;
    readonly search_text: string | null;
    readonly embedding: string | null;
    readonly embedding_model: string | null;
}

interface PlaybookStepRow {
    readonly kind: "prereq" | "step" | "watchout" | "anti_pattern" | "failure_mode";
    readonly position: number;
    readonly content: string;
}

interface PlaybookVariantRow {
    readonly position: number;
    readonly label: string;
    readonly description: string;
    readonly difference_from_base: string;
}

export class SqlitePlaybookRepository implements IPlaybookRepository {
    private readonly db: Database.Database;

    constructor(db: SqliteDatabaseInput, private readonly embeddingService?: IEmbeddingService) {
        this.db = ensureSqliteDatabase(db).client;
    }

    async listPlaybooks(query?: string, status?: PlaybookStatus, limit = 50): Promise<readonly PlaybookSummary[]> {
        const effectiveLimit = Math.min(Math.max(limit, 1), 100);
        const rows: readonly PlaybookRow[] = query?.trim()
            ? await this.rankPlaybookRows(query, effectiveLimit, status)
            : [...this.loadPlaybookRows(status)]
                .sort(comparePlaybookRows)
                .slice(0, effectiveLimit);
        return rows.map(mapPlaybookSummary);
    }

    async getPlaybook(playbookId: string): Promise<PlaybookRecord | null> {
        const row = this.loadPlaybookRow(playbookId);
        return row ? mapPlaybookRecord(row) : null;
    }

    async createPlaybook(input: PlaybookUpsertInput): Promise<PlaybookRecord> {
        const id = `playbook-${randomUUID()}`;
        const now = new Date().toISOString();
        const title = input.title.trim();
        const slug = ensureUniquePlaybookSlug(this.db, createPlaybookSlug(title));
        const payload = normalizePlaybookPayload(input, now);

        this.db.transaction(() => {
            this.db.prepare(`
                insert into playbooks_core (
                  id, title, slug, status, when_to_use, approach, use_count, last_used_at, created_at, updated_at
                ) values (
                  @id, @title, @slug, @status, @whenToUse, @approach, 0, null, @createdAt, @updatedAt
                )
            `).run({ id, title, slug, ...payload });
            replacePlaybookChildren(this.db, id, payload);
            upsertSearchDocument(this.db, {
                scope: "playbook",
                entityId: id,
                searchText: payload.searchText,
                updatedAt: payload.updatedAt,
            });

            updatePromotedSnapshots(this.db, payload.sourceSnapshotIdsList, id, now);
            appendDomainEvent(this.db, {
                eventTime: eventTimeFromIso(now),
                eventType: "playbook.drafted",
                schemaVer: 1,
                aggregateId: id,
                actor: "user",
                payload: {
                    playbook_id: id,
                    title,
                    slug,
                    source_evaluation_refs: payload.sourceSnapshotIdsList
                }
            });
        })();
        if (this.embeddingService) {
            void this.generateAndSaveEmbedding(id, buildPlaybookEmbeddingText({ title, slug, ...payload }));
        }

        return (await this.getPlaybook(id)) as PlaybookRecord;
    }

    async updatePlaybook(playbookId: string, input: Partial<PlaybookUpsertInput>): Promise<PlaybookRecord | null> {
        const existing = await this.getPlaybook(playbookId);
        if (!existing) return null;

        const title = input.title?.trim() || existing.title;
        const slug = title === existing.title
            ? existing.slug
            : ensureUniquePlaybookSlug(this.db, createPlaybookSlug(title), playbookId);
        const merged = normalizePlaybookPayload({
            title,
            status: input.status ?? existing.status,
            whenToUse: input.whenToUse ?? existing.whenToUse,
            prerequisites: input.prerequisites ?? existing.prerequisites,
            approach: input.approach ?? existing.approach,
            keySteps: input.keySteps ?? existing.keySteps,
            watchouts: input.watchouts ?? existing.watchouts,
            antiPatterns: input.antiPatterns ?? existing.antiPatterns,
            failureModes: input.failureModes ?? existing.failureModes,
            variants: input.variants ?? existing.variants,
            relatedPlaybookIds: input.relatedPlaybookIds ?? existing.relatedPlaybookIds,
            sourceSnapshotIds: input.sourceSnapshotIds ?? existing.sourceSnapshotIds,
            tags: input.tags ?? existing.tags,
        }, new Date().toISOString(), existing.createdAt);

        this.db.transaction(() => {
            this.db.prepare(`
                update playbooks_core
                set title = @title, slug = @slug, status = @status,
                    when_to_use = @whenToUse, approach = @approach,
                    updated_at = @updatedAt
                where id = @id
            `).run({ id: playbookId, title, slug, ...merged });
            replacePlaybookChildren(this.db, playbookId, merged);
            upsertSearchDocument(this.db, {
                scope: "playbook",
                entityId: playbookId,
                searchText: merged.searchText,
                updatedAt: merged.updatedAt,
            });

            updatePromotedSnapshots(this.db, merged.sourceSnapshotIdsList, playbookId, merged.updatedAt);
            if (existing.status !== "active" && merged.status === "active") {
                appendDomainEvent(this.db, {
                    eventTime: eventTimeFromIso(merged.updatedAt),
                    eventType: "playbook.published",
                    schemaVer: 1,
                    aggregateId: playbookId,
                    actor: "user",
                    payload: {
                        playbook_id: playbookId,
                        version: "1"
                    }
                });
            }
        })();
        if (this.embeddingService) {
            void this.generateAndSaveEmbedding(playbookId, buildPlaybookEmbeddingText({ title, slug, ...merged }));
        }

        return this.getPlaybook(playbookId);
    }

    private loadPlaybookRows(status?: PlaybookStatus): readonly PlaybookRow[] {
        const whereClause = status ? "where status = @status" : "";
        const rows = this.db.prepare<{ status?: PlaybookStatus }, PlaybookCoreRow>(
            `
            select
              p.id, p.title, p.slug, p.status, p.when_to_use, p.approach,
              p.use_count, p.last_used_at, p.created_at, p.updated_at,
              s.search_text, s.embedding, s.embedding_model
            from playbooks_core p
            left join search_documents s
              on s.scope = 'playbook' and s.entity_id = p.id
            ${whereClause}
            `,
        ).all(status ? { status } : {});
        return this.hydratePlaybookRows(rows);
    }

    private loadPlaybookRow(playbookId: string): PlaybookRow | null {
        const row = this.db.prepare<{ playbookId: string }, PlaybookCoreRow>(
            `
            select
              p.id, p.title, p.slug, p.status, p.when_to_use, p.approach,
              p.use_count, p.last_used_at, p.created_at, p.updated_at,
              s.search_text, s.embedding, s.embedding_model
            from playbooks_core p
            left join search_documents s
              on s.scope = 'playbook' and s.entity_id = p.id
            where p.id = @playbookId
            `,
        ).get({ playbookId });
        return row ? this.hydratePlaybookRows([row])[0] ?? null : null;
    }

    private hydratePlaybookRows(rows: readonly PlaybookCoreRow[]): readonly PlaybookRow[] {
        return rows.map((row) => hydratePlaybookRow(this.db, row));
    }

    private async rankPlaybookRows(query: string, limit: number, status?: PlaybookStatus): Promise<readonly PlaybookRow[]> {
        const rows = this.loadPlaybookRows(status);
        if (rows.length === 0) return [];
        const lexicalMatches = scoreLexicalMatches(rows, query);
        let semanticMatches: readonly { row: PlaybookRow; score: number }[] = [];
        if (this.embeddingService && query.trim().length > 0) {
            try {
                semanticMatches = await this.scoreSemanticMatches(rows, query);
            } catch (error) {
                console.warn("[monitor-server] semantic playbook search failed; falling back to lexical search:", error instanceof Error ? error.message : error);
            }
        }
        return mergeRankedPlaybookRows(semanticMatches, lexicalMatches, limit);
    }

    private async scoreSemanticMatches(rows: readonly PlaybookRow[], query: string): Promise<readonly { row: PlaybookRow; score: number }[]> {
        const embeddedRows = rows.filter((row) => typeof row.embedding === "string" && row.embedding.length > 0);
        if (embeddedRows.length === 0) return [];
        const queryVector = await this.embeddingService!.embed(query);
        return embeddedRows
            .map((row) => ({ row, score: cosineSimilarity(queryVector, deserializeEmbedding(row.embedding as string)) }))
            .filter((entry) => entry.score >= MIN_SEMANTIC_SCORE)
            .sort((left, right) => right.score - left.score || comparePlaybookRows(left.row, right.row));
    }

    private async generateAndSaveEmbedding(playbookId: string, embeddingText: string): Promise<void> {
        try {
            const vector = await this.embeddingService!.embed(embeddingText);
            this.db.prepare(`
                update search_documents
                set embedding = @embedding, embedding_model = @embeddingModel
                where scope = 'playbook' and entity_id = @playbookId
            `).run({ playbookId, embedding: serializeEmbedding(vector), embeddingModel: this.embeddingService!.modelId });
        } catch (error) {
            if (isClosedDatabaseError(error)) return;
            console.warn("[monitor-server] playbook embedding generation failed:", error instanceof Error ? error.message : error);
        }
    }
}

function ensureUniquePlaybookSlug(db: Database.Database, baseSlug: string, ignoreId?: string): string {
    const fallbackSlug = baseSlug || "playbook";
    let slug = fallbackSlug;
    let suffix = 2;
    for (let attempt = 0; attempt < 200; attempt += 1) {
        const existing = db.prepare<{ slug: string; ignoreId?: string }, { id: string }>(
            ignoreId
                ? "select id from playbooks_core where slug = @slug and id != @ignoreId"
                : "select id from playbooks_core where slug = @slug",
        ).get(ignoreId ? { slug, ignoreId } : { slug });
        if (!existing) return slug;
        slug = `${fallbackSlug}-${suffix++}`;
    }
    throw new Error(`Could not generate a unique slug for "${baseSlug}" after 200 attempts`);
}

function updatePromotedSnapshots(db: Database.Database, snapshotIds: readonly string[], playbookId: string, promotedAt: string): void {
    const snapshotRefs = uniqueSnapshotRefs(
        snapshotIds.map(parseSnapshotReference).filter((v): v is SnapshotReference => Boolean(v)),
    );
    db.prepare("delete from evaluation_promotions where playbook_id = @playbookId").run({ playbookId });
    if (snapshotRefs.length === 0) return;
    const statement = db.prepare(`
        insert into evaluation_promotions (task_id, scope_key, playbook_id, promoted_at)
        select @taskId, @scopeKey, @playbookId, @promotedAt
        where exists (
          select 1
          from evaluations_core
          where task_id = @taskId and scope_key = @scopeKey
        )
    `);
    for (const ref of snapshotRefs) {
        statement.run({ playbookId, taskId: ref.taskId, scopeKey: ref.scopeKey, promotedAt });
    }
}

type NormalizedPlaybookPayload = ReturnType<typeof normalizePlaybookPayload>;

function hydratePlaybookRow(db: Database.Database, row: PlaybookCoreRow): PlaybookRow {
    const steps = db.prepare<{ playbookId: string }, PlaybookStepRow>(`
        select kind, position, content
        from playbook_steps
        where playbook_id = @playbookId
        order by kind asc, position asc
    `).all({ playbookId: row.id });
    const variants = db.prepare<{ playbookId: string }, PlaybookVariantRow>(`
        select position, label, description, difference_from_base
        from playbook_variants
        where playbook_id = @playbookId
        order by position asc
    `).all({ playbookId: row.id });
    const tags = db.prepare<{ playbookId: string }, { tag: string }>(`
        select tag
        from playbook_tags
        where playbook_id = @playbookId
        order by tag asc
    `).all({ playbookId: row.id }).map((value) => value.tag);
    const relatedPlaybookIds = db.prepare<{ playbookId: string }, { related_playbook_id: string }>(`
        select related_playbook_id
        from playbook_relations
        where playbook_id = @playbookId
        order by coalesce(position, 0) asc, related_playbook_id asc
    `).all({ playbookId: row.id }).map((value) => value.related_playbook_id);
    const sourceSnapshotIds = db.prepare<{ playbookId: string }, { task_id: string; scope_key: string }>(`
        select task_id, scope_key
        from playbook_source_snapshots
        where playbook_id = @playbookId
        order by task_id asc, scope_key asc
    `).all({ playbookId: row.id }).map((value) => `${value.task_id}#${value.scope_key}`);

    return {
        ...row,
        prerequisites: jsonList(stepsForKind(steps, "prereq")),
        key_steps: jsonList(stepsForKind(steps, "step")),
        watchouts: jsonList(stepsForKind(steps, "watchout")),
        anti_patterns: jsonList(stepsForKind(steps, "anti_pattern")),
        failure_modes: jsonList(stepsForKind(steps, "failure_mode")),
        variants: variants.length > 0 ? JSON.stringify(variants.map((variant) => ({
            label: variant.label,
            description: variant.description,
            differenceFromBase: variant.difference_from_base,
        }))) : null,
        related_playbook_ids: jsonList(relatedPlaybookIds),
        source_snapshot_ids: jsonList(sourceSnapshotIds),
        tags: jsonList(tags),
    };
}

function replacePlaybookChildren(db: Database.Database, playbookId: string, payload: NormalizedPlaybookPayload): void {
    for (const table of [
        "playbook_steps",
        "playbook_variants",
        "playbook_tags",
        "playbook_relations",
        "playbook_source_snapshots",
    ]) {
        db.prepare(`delete from ${table} where playbook_id = @playbookId`).run({ playbookId });
    }

    insertPlaybookSteps(db, playbookId, "prereq", parseJsonList(payload.prerequisites));
    insertPlaybookSteps(db, playbookId, "step", parseJsonList(payload.keySteps));
    insertPlaybookSteps(db, playbookId, "watchout", parseJsonList(payload.watchouts));
    insertPlaybookSteps(db, playbookId, "anti_pattern", parseJsonList(payload.antiPatterns));
    insertPlaybookSteps(db, playbookId, "failure_mode", parseJsonList(payload.failureModes));
    insertPlaybookVariants(db, playbookId, payload.variants);
    insertPlaybookTags(db, playbookId, parseJsonList(payload.tags));
    insertPlaybookRelations(db, playbookId, parseJsonList(payload.relatedPlaybookIds));
    insertPlaybookSourceSnapshots(db, playbookId, payload.sourceSnapshotIdsList);
}

function insertPlaybookSteps(
    db: Database.Database,
    playbookId: string,
    kind: PlaybookStepRow["kind"],
    values: readonly string[],
): void {
    if (values.length === 0) return;
    const statement = db.prepare(`
        insert into playbook_steps (playbook_id, kind, position, content)
        values (@playbookId, @kind, @position, @content)
    `);
    values.forEach((content, index) => statement.run({ playbookId, kind, position: index, content }));
}

function insertPlaybookVariants(db: Database.Database, playbookId: string, rawVariants: string | null): void {
    if (!rawVariants) return;
    const variants = JSON.parse(rawVariants) as PlaybookRecord["variants"];
    if (variants.length === 0) return;
    const statement = db.prepare(`
        insert into playbook_variants (playbook_id, position, label, description, difference_from_base)
        values (@playbookId, @position, @label, @description, @differenceFromBase)
    `);
    variants.forEach((variant, index) => statement.run({
        playbookId,
        position: index,
        label: variant.label,
        description: variant.description,
        differenceFromBase: variant.differenceFromBase,
    }));
}

function insertPlaybookTags(db: Database.Database, playbookId: string, tags: readonly string[]): void {
    if (tags.length === 0) return;
    const statement = db.prepare(`
        insert into playbook_tags (playbook_id, tag)
        values (@playbookId, @tag)
    `);
    for (const tag of tags) {
        statement.run({ playbookId, tag });
    }
}

function insertPlaybookRelations(db: Database.Database, playbookId: string, relatedPlaybookIds: readonly string[]): void {
    if (relatedPlaybookIds.length === 0) return;
    const statement = db.prepare(`
        insert into playbook_relations (playbook_id, related_playbook_id, kind, position)
        select @playbookId, @relatedPlaybookId, null, @position
        where exists (
          select 1 from playbooks_core where id = @relatedPlaybookId
        )
    `);
    relatedPlaybookIds.forEach((relatedPlaybookId, index) => {
        statement.run({ playbookId, relatedPlaybookId, position: index });
    });
}

function insertPlaybookSourceSnapshots(db: Database.Database, playbookId: string, snapshotIds: readonly string[]): void {
    const refs = uniqueSnapshotRefs(
        snapshotIds.map(parseSnapshotReference).filter((value): value is SnapshotReference => Boolean(value)),
    );
    if (refs.length === 0) return;
    const statement = db.prepare(`
        insert into playbook_source_snapshots (playbook_id, task_id, scope_key)
        select @playbookId, @taskId, @scopeKey
        where exists (
          select 1
          from evaluations_core
          where task_id = @taskId and scope_key = @scopeKey
        )
    `);
    for (const ref of refs) {
        statement.run({ playbookId, taskId: ref.taskId, scopeKey: ref.scopeKey });
    }
}

function stepsForKind(steps: readonly PlaybookStepRow[], kind: PlaybookStepRow["kind"]): readonly string[] {
    return steps.filter((step) => step.kind === kind).map((step) => step.content);
}

function jsonList(values: readonly string[]): string | null {
    return values.length > 0 ? JSON.stringify(values) : null;
}

function mergeRankedPlaybookRows(
    semanticMatches: readonly { row: PlaybookRow; score: number }[],
    lexicalMatches: readonly { row: PlaybookRow; score: number }[],
    limit: number,
): readonly PlaybookRow[] {
    const ranked = new Map<string, RankedPlaybookRow>();
    for (const semantic of semanticMatches) {
        ranked.set(semantic.row.id, { row: semantic.row, lexicalScore: 0, semanticScore: semantic.score });
    }
    for (const lexical of lexicalMatches) {
        const existing = ranked.get(lexical.row.id);
        if (existing) {
            ranked.set(lexical.row.id, { ...existing, lexicalScore: Math.max(existing.lexicalScore, lexical.score) });
            continue;
        }
        ranked.set(lexical.row.id, { row: lexical.row, lexicalScore: lexical.score, semanticScore: null });
    }
    return [...ranked.values()]
        .sort((left, right) =>
            combinedScore(right) - combinedScore(left) ||
            (right.semanticScore ?? 0) - (left.semanticScore ?? 0) ||
            right.lexicalScore - left.lexicalScore ||
            comparePlaybookRows(left.row, right.row))
        .slice(0, limit)
        .map((entry) => entry.row);
}

function scoreLexicalMatches(rows: readonly PlaybookRow[], query: string): readonly { row: PlaybookRow; score: number }[] {
    const normalizedQuery = normalizeSearchText(query);
    if (!normalizedQuery) return [];
    const queryTokens = tokenizeText(normalizedQuery);
    return rows
        .map((row) => ({ row, score: computeLexicalScore(row, normalizedQuery, queryTokens) }))
        .filter((entry) => entry.score > 0)
        .sort((left, right) => right.score - left.score || comparePlaybookRows(left.row, right.row));
}

function computeLexicalScore(row: PlaybookRow, normalizedQuery: string, queryTokens: readonly string[]): number {
    const fields = buildSearchFields(row);
    const combinedText = fields.map((f) => f.value).filter(Boolean).join(" ");
    const matchedTokens = new Set<string>();
    let score = 0;
    if (combinedText.includes(normalizedQuery)) score += 18;
    for (const field of fields) {
        if (!field.value) continue;
        if (field.value.includes(normalizedQuery)) score += field.weight * 2;
        for (const token of queryTokens) {
            if (!field.value.includes(token)) continue;
            matchedTokens.add(token);
            score += field.weight;
        }
    }
    if (queryTokens.length > 1 && matchedTokens.size === queryTokens.length) score += queryTokens.length * 4;
    return score;
}

function buildSearchFields(row: PlaybookRow): ReadonlyArray<{ value: string; weight: number }> {
    const tags = row.tags ? parseJsonList(row.tags).join(" ") : "";
    return [
        { value: normalizeSearchText(row.title) ?? "", weight: 12 },
        { value: normalizeSearchText(row.when_to_use) ?? "", weight: 10 },
        { value: normalizeSearchText(tags) ?? "", weight: 8 },
        { value: normalizeSearchText(row.approach) ?? "", weight: 7 },
        { value: normalizeSearchText(row.watchouts) ?? "", weight: 6 },
        { value: normalizeSearchText(row.key_steps) ?? "", weight: 6 },
        { value: normalizeSearchText(row.failure_modes) ?? "", weight: 5 },
        { value: normalizeSearchText(row.search_text) ?? "", weight: 6 },
    ];
}

function combinedScore(entry: RankedPlaybookRow): number {
    return (entry.semanticScore ?? 0) * 100 + entry.lexicalScore;
}

function comparePlaybookRows(left: PlaybookRow, right: PlaybookRow): number {
    return playbookStatusRank(right.status) - playbookStatusRank(left.status)
        || Date.parse(right.updated_at) - Date.parse(left.updated_at);
}

function playbookStatusRank(status: string): number {
    return status === "active" ? 3 : status === "draft" ? 2 : status === "archived" ? 1 : 0;
}

function normalizePlaybookPayload(input: Partial<PlaybookUpsertInput>, updatedAt: string, createdAt = updatedAt) {
    const title = input.title?.trim() ?? "Untitled playbook";
    const whenToUse = normalizeOptionalText(input.whenToUse);
    const approach = normalizeOptionalText(input.approach);
    const prerequisites = normalizeStringList(input.prerequisites);
    const keySteps = normalizeStringList(input.keySteps);
    const watchouts = normalizeStringList(input.watchouts);
    const antiPatterns = normalizeStringList(input.antiPatterns);
    const failureModes = normalizeStringList(input.failureModes);
    const relatedPlaybookIds = normalizeStringList(input.relatedPlaybookIds);
    const sourceSnapshotIds = normalizeStringList(input.sourceSnapshotIds);
    const tags = normalizeStringList(input.tags);
    const variants = normalizeVariants(input.variants);
    return {
        status: input.status ?? "draft",
        whenToUse,
        prerequisites: prerequisites.length > 0 ? JSON.stringify(prerequisites) : null,
        approach,
        keySteps: keySteps.length > 0 ? JSON.stringify(keySteps) : null,
        watchouts: watchouts.length > 0 ? JSON.stringify(watchouts) : null,
        antiPatterns: antiPatterns.length > 0 ? JSON.stringify(antiPatterns) : null,
        failureModes: failureModes.length > 0 ? JSON.stringify(failureModes) : null,
        variants: variants.length > 0 ? JSON.stringify(variants) : null,
        relatedPlaybookIds: relatedPlaybookIds.length > 0 ? JSON.stringify(relatedPlaybookIds) : null,
        sourceSnapshotIds: sourceSnapshotIds.length > 0 ? JSON.stringify(sourceSnapshotIds) : null,
        sourceSnapshotIdsList: sourceSnapshotIds,
        tags: tags.length > 0 ? JSON.stringify(tags) : null,
        searchText: buildPlaybookSearchText({ title, whenToUse, approach, prerequisites, keySteps, watchouts, antiPatterns, failureModes, tags }),
        createdAt,
        updatedAt,
    };
}

function buildPlaybookEmbeddingText(input: {
    title: string; slug: string; whenToUse?: string | null; approach?: string | null;
    prerequisites?: string | null; keySteps?: string | null; watchouts?: string | null;
    antiPatterns?: string | null; failureModes?: string | null; tags?: string | null; searchText?: string | null;
}): string {
    return [input.title, input.slug, input.whenToUse, input.approach, input.prerequisites,
        input.keySteps, input.watchouts, input.antiPatterns, input.failureModes, input.tags, input.searchText]
        .map((part) => normalizeEmbeddingSection(part))
        .filter((part): part is string => Boolean(part))
        .join("\n\n");
}

function buildPlaybookSearchText(input: {
    title: string; whenToUse: string | null; approach: string | null;
    prerequisites: readonly string[]; keySteps: readonly string[]; watchouts: readonly string[];
    antiPatterns: readonly string[]; failureModes: readonly string[]; tags: readonly string[];
}): string {
    return [input.title, input.whenToUse, input.approach,
        input.prerequisites.join(" "), input.keySteps.join(" "), input.watchouts.join(" "),
        input.antiPatterns.join(" "), input.failureModes.join(" "), input.tags.join(" ")]
        .map(normalizeOptionalText)
        .filter((part): part is string => Boolean(part))
        .join(" ");
}

function normalizeStringList(values?: readonly string[] | null): readonly string[] {
    if (!values) return [];
    return [...new Set(values.map(normalizeOptionalText).filter((v): v is string => Boolean(v)))];
}

function normalizeVariants(values?: PlaybookRecord["variants"] | null): PlaybookRecord["variants"] {
    if (!values) return [];
    return values
        .map((v) => ({ label: normalizeOptionalText(v.label), description: normalizeOptionalText(v.description), differenceFromBase: normalizeOptionalText(v.differenceFromBase) }))
        .filter((v): v is { label: string; description: string; differenceFromBase: string } =>
            Boolean(v.label && v.description && v.differenceFromBase));
}

function normalizeOptionalText(value?: string | null): string | null {
    if (!value) return null;
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
}

function createPlaybookSlug(title: string): string {
    return title.toLocaleLowerCase().normalize("NFKC")
        .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

function parseSnapshotReference(snapshotId: string): SnapshotReference | null {
    const trimmed = snapshotId.trim();
    if (!trimmed) return null;
    const versionSeparator = trimmed.lastIndexOf(":v");
    const withoutVersion = versionSeparator >= 0 ? trimmed.slice(0, versionSeparator) : trimmed;
    const scopeSeparator = withoutVersion.indexOf("#");
    if (scopeSeparator === -1) return { taskId: withoutVersion, scopeKey: "task" };
    const taskId = withoutVersion.slice(0, scopeSeparator);
    const scopeKey = withoutVersion.slice(scopeSeparator + 1);
    if (!taskId || !scopeKey) return null;
    return { taskId, scopeKey };
}

function uniqueSnapshotRefs(values: readonly SnapshotReference[]): readonly SnapshotReference[] {
    const seen = new Set<string>();
    return values.filter((v) => {
        const key = `${v.taskId}#${v.scopeKey}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function tokenizeText(value: string): readonly string[] {
    const seen = new Set<string>();
    const tokens: string[] = [];
    for (const rawToken of value.split(/[^\p{L}\p{N}]+/u)) {
        const token = rawToken.trim();
        if (!token || seen.has(token)) continue;
        seen.add(token);
        tokens.push(token);
    }
    return tokens.length > 0 ? tokens : [value];
}

function isClosedDatabaseError(error: unknown): boolean {
    return error instanceof Error && /database connection is not open/i.test(error.message);
}
