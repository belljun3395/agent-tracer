import { eq, isNull } from "drizzle-orm";
import type { IRuleCommandRepository, RuleCommandRecord, RuleCommandCreateInput } from "~application/ports/repository/rule-command.repository.js";
import { ensureSqliteDatabase, type SqliteDatabase, type SqliteDatabaseInput } from "../shared/drizzle.db.js";
import { ruleCommands } from "../schema/drizzle.schema.js";
import { type RuleCommandRow, mapRuleCommandRow } from "./sqlite.rule-command.row.type.js";

export class SqliteRuleCommandRepository implements IRuleCommandRepository {
  private readonly db: SqliteDatabase;

  constructor(db: SqliteDatabaseInput) {
    this.db = ensureSqliteDatabase(db);
  }

  async create(input: RuleCommandCreateInput): Promise<RuleCommandRecord> {
    const now = new Date().toISOString();
    this.db.orm
      .insert(ruleCommands)
      .values({
        id: input.id,
        pattern: input.pattern,
        label: input.label,
        taskId: input.taskId ?? null,
        createdAt: now,
      })
      .run();

    const row = this.db.orm
      .select()
      .from(ruleCommands)
      .where(eq(ruleCommands.id, input.id))
      .limit(1)
      .get() as RuleCommandRow | undefined;

    if (!row) {
      throw new Error(`RuleCommand insert succeeded but row not found: ${input.id}`);
    }
    return mapRuleCommandRow(row);
  }

  async findAll(): Promise<readonly RuleCommandRecord[]> {
    const rows = this.db.orm.select().from(ruleCommands).all() as readonly RuleCommandRow[];
    return rows.map(mapRuleCommandRow);
  }

  async findByTaskId(taskId: string): Promise<readonly RuleCommandRecord[]> {
    const rows = this.db.orm
      .select()
      .from(ruleCommands)
      .where(eq(ruleCommands.taskId, taskId))
      .all() as readonly RuleCommandRow[];
    return rows.map(mapRuleCommandRow);
  }

  async findGlobal(): Promise<readonly RuleCommandRecord[]> {
    const rows = this.db.orm
      .select()
      .from(ruleCommands)
      .where(isNull(ruleCommands.taskId))
      .all() as readonly RuleCommandRow[];
    return rows.map(mapRuleCommandRow);
  }

  async delete(id: string): Promise<boolean> {
    const result = this.db.orm.delete(ruleCommands).where(eq(ruleCommands.id, id)).run();
    return result.changes > 0;
  }
}
