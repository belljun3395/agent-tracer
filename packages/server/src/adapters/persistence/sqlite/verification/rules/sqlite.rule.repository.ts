import { and, asc, desc, eq, isNull, or, type SQL } from "drizzle-orm";
import type {
    IRuleRepository,
    ListRulesFilter,
    RuleInsertInput,
    RuleUpdateInput,
    RuleWithSignature,
} from "~application/ports/repository/rule.repository.js";
import { normalizeRuleExpectedAction } from "~domain/verification/index.js";
import { ensureSqliteDatabase, type SqliteDatabase, type SqliteDatabaseInput } from "~adapters/persistence/sqlite/shared/drizzle.db.js";
import { rules } from "../sqlite.verification.tables.js";

type RuleRow = typeof rules.$inferSelect;

export class SqliteRuleRepository implements IRuleRepository {
    private readonly db: SqliteDatabase;

    constructor(db: SqliteDatabaseInput) {
        this.db = ensureSqliteDatabase(db);
    }

    async insert(input: RuleInsertInput): Promise<RuleWithSignature> {
        this.db.orm
            .insert(rules)
            .values({
                id: input.id,
                name: input.name,
                triggerPhrasesJson: input.trigger ? JSON.stringify(input.trigger.phrases) : null,
                triggerOn: input.triggerOn ?? null,
                expectTool: input.expect.action ?? null,
                expectCommandMatchesJson: input.expect.commandMatches
                    ? JSON.stringify(input.expect.commandMatches)
                    : null,
                expectPattern: input.expect.pattern ?? null,
                scope: input.scope,
                taskId: input.taskId ?? null,
                source: input.source,
                severity: input.severity,
                rationale: input.rationale ?? null,
                signature: input.signature,
                createdAt: input.createdAt,
                deletedAt: null,
            })
            .run();
        const found = await this.findById(input.id);
        if (!found) throw new Error(`Rule ${input.id} disappeared after insert`);
        return found;
    }

    async findById(id: string): Promise<RuleWithSignature | null> {
        const row = this.db.orm
            .select()
            .from(rules)
            .where(and(eq(rules.id, id), isNull(rules.deletedAt)))
            .limit(1)
            .get();
        return row ? mapRow(row) : null;
    }

    async list(filter?: ListRulesFilter): Promise<readonly RuleWithSignature[]> {
        const conditions: SQL[] = [isNull(rules.deletedAt)];
        if (filter?.scope) {
            conditions.push(eq(rules.scope, filter.scope));
        }
        if (filter?.taskId) {
            conditions.push(eq(rules.taskId, filter.taskId));
        }
        if (filter?.source) {
            conditions.push(eq(rules.source, filter.source));
        }
        const rows = this.db.orm
            .select()
            .from(rules)
            .where(and(...conditions))
            .orderBy(desc(rules.createdAt))
            .all();
        return rows.map(mapRow);
    }

    async update(id: string, patch: RuleUpdateInput, newSignature: string): Promise<RuleWithSignature | null> {
        const values: Partial<typeof rules.$inferInsert> = { signature: newSignature };
        if (patch.name !== undefined) {
            values.name = patch.name;
        }
        if (patch.severity !== undefined) {
            values.severity = patch.severity;
        }
        if (patch.rationale !== undefined) {
            values.rationale = patch.rationale;
        }
        if (patch.triggerOn !== undefined) {
            values.triggerOn = patch.triggerOn;
        }
        if (patch.trigger !== undefined) {
            values.triggerPhrasesJson = patch.trigger ? JSON.stringify(patch.trigger.phrases) : null;
        }
        if (patch.expect !== undefined) {
            if (patch.expect.action !== undefined) {
                values.expectTool = patch.expect.action;
            }
            if (patch.expect.commandMatches !== undefined) {
                values.expectCommandMatchesJson = patch.expect.commandMatches
                    ? JSON.stringify(patch.expect.commandMatches)
                    : null;
            }
            if (patch.expect.pattern !== undefined) {
                values.expectPattern = patch.expect.pattern;
            }
        }
        const info = this.db.orm
            .update(rules)
            .set(values)
            .where(and(eq(rules.id, id), isNull(rules.deletedAt)))
            .run();
        if (info.changes === 0) return null;
        return this.findById(id);
    }

    async softDelete(id: string, deletedAt: string): Promise<boolean> {
        const info = this.db.orm
            .update(rules)
            .set({ deletedAt })
            .where(and(eq(rules.id, id), isNull(rules.deletedAt)))
            .run();
        return info.changes > 0;
    }

    async findActiveForTurn(taskId: string): Promise<readonly RuleWithSignature[]> {
        const rows = this.db.orm
            .select()
            .from(rules)
            .where(
                and(
                    isNull(rules.deletedAt),
                    or(
                        eq(rules.scope, "global"),
                        and(eq(rules.scope, "task"), eq(rules.taskId, taskId)),
                    ),
                ),
            )
            .orderBy(asc(rules.createdAt))
            .all();
        return rows.map(mapRow);
    }

    async findBySignature(signature: string): Promise<RuleWithSignature | null> {
        const row = this.db.orm
            .select()
            .from(rules)
            .where(and(eq(rules.signature, signature), isNull(rules.deletedAt)))
            .limit(1)
            .get();
        return row ? mapRow(row) : null;
    }
}

function mapRow(row: RuleRow): RuleWithSignature {
    const action = row.expectTool !== null
        ? normalizeRuleExpectedAction(row.expectTool)
        : null;
    return {
        id: row.id,
        name: row.name,
        ...(row.triggerPhrasesJson
            ? { trigger: { phrases: JSON.parse(row.triggerPhrasesJson) as readonly string[] } }
            : {}),
        ...(row.triggerOn === "user" || row.triggerOn === "assistant"
            ? { triggerOn: row.triggerOn }
            : {}),
        expect: {
            ...(action !== null ? { action } : {}),
            ...(row.expectCommandMatchesJson !== null
                ? { commandMatches: JSON.parse(row.expectCommandMatchesJson) as readonly string[] }
                : {}),
            ...(row.expectPattern !== null ? { pattern: row.expectPattern } : {}),
        },
        scope: row.scope as "global" | "task",
        ...(row.taskId !== null ? { taskId: row.taskId } : {}),
        source: row.source as "human" | "agent",
        severity: row.severity as "info" | "warn" | "block",
        ...(row.rationale !== null ? { rationale: row.rationale } : {}),
        signature: row.signature,
        createdAt: row.createdAt,
    };
}
