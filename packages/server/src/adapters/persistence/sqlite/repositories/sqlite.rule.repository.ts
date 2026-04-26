import type Database from "better-sqlite3";
import type {
    IRuleRepository,
    RuleInsertInput,
    ListRulesFilter,
    RuleUpdateInput,
} from "~application/ports/repository/rule.repository.js";
import type { Rule } from "~domain/verification/index.js";
import { computeRuleSignature } from "~domain/verification/index.js";
import { ensureSqliteDatabase, type SqliteDatabaseInput } from "../shared/drizzle.db.js";
import { appendDomainEvent, eventTimeFromIso } from "../events/index.js";
import { mapRuleRow, type RuleRow } from "./sqlite.rule.row.type.js";

function serializePatchForEvent(patch: RuleUpdateInput): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    if (patch.name !== undefined) out["name"] = patch.name;
    if (patch.severity !== undefined) out["severity"] = patch.severity;
    if (patch.triggerOn !== undefined) out["triggerOn"] = patch.triggerOn;
    if (patch.trigger !== undefined) {
        out["trigger"] = patch.trigger === null
            ? null
            : { phrases: [...patch.trigger.phrases] };
    }
    if (patch.expect !== undefined) {
        const expect: Record<string, unknown> = {};
        if (patch.expect.tool !== undefined) expect["tool"] = patch.expect.tool;
        if (patch.expect.commandMatches !== undefined) {
            expect["commandMatches"] = patch.expect.commandMatches === null
                ? null
                : [...patch.expect.commandMatches];
        }
        if (patch.expect.pattern !== undefined) expect["pattern"] = patch.expect.pattern;
        out["expect"] = expect;
    }
    return out;
}

export class SqliteRuleRepository implements IRuleRepository {
    private readonly db: Database.Database;

    constructor(db: SqliteDatabaseInput) {
        this.db = ensureSqliteDatabase(db).client;
    }

    async insert(input: RuleInsertInput): Promise<Rule> {
        const triggerPhrasesJson = input.trigger
            ? JSON.stringify([...input.trigger.phrases])
            : null;
        const expectCommandMatchesJson = input.expect.commandMatches
            ? JSON.stringify([...input.expect.commandMatches])
            : null;

        this.db.transaction(() => {
            this.db
                .prepare(`
                    insert into rules_current (
                        id, name, trigger_phrases_json, trigger_on,
                        expect_tool, expect_command_matches_json, expect_pattern,
                        scope, task_id, source, severity, rationale, created_at
                    ) values (
                        @id, @name, @triggerPhrasesJson, @triggerOn,
                        @expectTool, @expectCommandMatchesJson, @expectPattern,
                        @scope, @taskId, @source, @severity, @rationale, @createdAt
                    )
                `)
                .run({
                    id: input.id,
                    name: input.name,
                    triggerPhrasesJson,
                    triggerOn: input.triggerOn ?? null,
                    expectTool: input.expect.tool ?? null,
                    expectCommandMatchesJson,
                    expectPattern: input.expect.pattern ?? null,
                    scope: input.scope,
                    taskId: input.taskId ?? null,
                    source: input.source,
                    severity: input.severity,
                    rationale: input.rationale ?? null,
                    createdAt: input.createdAt,
                });

            appendDomainEvent(this.db, {
                eventTime: eventTimeFromIso(input.createdAt),
                eventType: "rule.registered",
                schemaVer: 1,
                aggregateId: input.taskId ?? input.id,
                actor: input.source === "human" ? "user" : "claude",
                payload: {
                    rule_id: input.id,
                    name: input.name,
                    scope: input.scope,
                    source: input.source,
                    severity: input.severity,
                    ...(input.taskId ? { task_id: input.taskId } : {}),
                },
            });
        })();

        const row = this.selectById(input.id);
        if (!row) {
            throw new Error(`Failed to load rule ${input.id} immediately after insert`);
        }
        return mapRuleRow(row);
    }

    async findById(id: string): Promise<Rule | null> {
        const row = this.selectById(id);
        return row ? mapRuleRow(row) : null;
    }

    async list(filter?: ListRulesFilter): Promise<readonly Rule[]> {
        const clauses: string[] = [];
        const params: Record<string, string> = {};
        if (filter?.source !== undefined) {
            clauses.push("source = @source");
            params["source"] = filter.source;
        }
        if (filter?.taskId !== undefined) {
            // Per ListRulesFilter contract: when taskId is set, return global + that task's rules
            clauses.push("(scope = 'global' or task_id = @taskId)");
            params["taskId"] = filter.taskId;
        } else if (filter?.scope !== undefined) {
            clauses.push("scope = @scope");
            params["scope"] = filter.scope;
        }
        const where = clauses.length > 0 ? `where ${clauses.join(" and ")}` : "";
        const rows = this.db
            .prepare<Record<string, string>, RuleRow>(
                `select id, name, trigger_phrases_json, trigger_on, expect_tool, expect_command_matches_json, expect_pattern,
                        scope, task_id, source, severity, rationale, created_at
                 from rules_current
                 ${where}
                 order by created_at asc`,
            )
            .all(params);
        return rows.map(mapRuleRow);
    }

    async update(id: string, patch: RuleUpdateInput): Promise<Rule | null> {
        const existing = this.selectById(id);
        if (!existing) return null;

        const sets: string[] = [];
        const params: Record<string, string | null> = { id };

        if (patch.name !== undefined) {
            sets.push("name = @name");
            params["name"] = patch.name;
        }
        if (patch.severity !== undefined) {
            sets.push("severity = @severity");
            params["severity"] = patch.severity;
        }
        if (patch.triggerOn !== undefined) {
            if (patch.triggerOn === null) {
                sets.push("trigger_on = NULL");
            } else {
                sets.push("trigger_on = @triggerOn");
                params["triggerOn"] = patch.triggerOn;
            }
        }
        if (patch.trigger !== undefined) {
            if (patch.trigger === null) {
                sets.push("trigger_phrases_json = NULL");
            } else {
                sets.push("trigger_phrases_json = @triggerPhrasesJson");
                params["triggerPhrasesJson"] = JSON.stringify([...patch.trigger.phrases]);
            }
        }
        if (patch.expect !== undefined) {
            if (patch.expect.tool !== undefined) {
                if (patch.expect.tool === null) {
                    sets.push("expect_tool = NULL");
                } else {
                    sets.push("expect_tool = @expectTool");
                    params["expectTool"] = patch.expect.tool;
                }
            }
            if (patch.expect.commandMatches !== undefined) {
                if (patch.expect.commandMatches === null) {
                    sets.push("expect_command_matches_json = NULL");
                } else {
                    sets.push("expect_command_matches_json = @expectCommandMatchesJson");
                    params["expectCommandMatchesJson"] = JSON.stringify(
                        [...patch.expect.commandMatches],
                    );
                }
            }
            if (patch.expect.pattern !== undefined) {
                if (patch.expect.pattern === null) {
                    sets.push("expect_pattern = NULL");
                } else {
                    sets.push("expect_pattern = @expectPattern");
                    params["expectPattern"] = patch.expect.pattern;
                }
            }
        }

        if (sets.length === 0) {
            return mapRuleRow(existing);
        }

        const sql = `update rules_current set ${sets.join(", ")} where id = @id`;
        this.db.transaction(() => {
            this.db.prepare(sql).run(params);

            appendDomainEvent(this.db, {
                eventTime: eventTimeFromIso(new Date().toISOString()),
                eventType: "rule.updated",
                schemaVer: 1,
                aggregateId: existing.task_id ?? existing.id,
                actor: "user",
                payload: {
                    rule_id: id,
                    patch: serializePatchForEvent(patch),
                },
            });
        })();

        const updated = this.selectById(id);
        return updated ? mapRuleRow(updated) : null;
    }

    async delete(id: string): Promise<boolean> {
        const result = this.db
            .prepare("delete from rules_current where id = @id")
            .run({ id });
        return result.changes > 0;
    }

    async findActiveForTurn(taskId: string): Promise<readonly Rule[]> {
        const rows = this.db
            .prepare<{ taskId: string }, RuleRow>(
                `select id, name, trigger_phrases_json, trigger_on, expect_tool, expect_command_matches_json, expect_pattern,
                        scope, task_id, source, severity, rationale, created_at
                 from rules_current
                 where scope = 'global' or task_id = @taskId
                 order by created_at asc`,
            )
            .all({ taskId });
        return rows.map(mapRuleRow);
    }

    async findBySignature(signature: string): Promise<Rule | null> {
        // Compute signature in-memory by listing all rules.
        const all = await this.list();
        for (const rule of all) {
            const ruleSignature = computeRuleSignature({
                ...(rule.trigger ? { trigger: rule.trigger } : {}),
                expect: rule.expect,
            });
            if (ruleSignature === signature) {
                return rule;
            }
        }
        return null;
    }

    private selectById(id: string): RuleRow | undefined {
        return this.db
            .prepare<{ id: string }, RuleRow>(
                `select id, name, trigger_phrases_json, trigger_on, expect_tool, expect_command_matches_json, expect_pattern,
                        scope, task_id, source, severity, rationale, created_at
                 from rules_current
                 where id = @id`,
            )
            .get({ id });
    }
}
