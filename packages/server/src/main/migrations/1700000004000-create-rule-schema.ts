import type { MigrationInterface, QueryRunner } from "typeorm";

export class CreateRuleSchema1700000004000 implements MigrationInterface {
    async up(qr: QueryRunner): Promise<void> {
        await qr.query(`
            create table if not exists rules (
                id text primary key,
                name text not null,
                trigger_phrases_json text,
                trigger_on text check(trigger_on in ('user','assistant')),
                expect_tool text,
                expect_command_matches_json text,
                expect_pattern text,
                scope text not null check(scope in ('global','task')),
                task_id text references tasks_current(id) on delete cascade,
                source text not null check(source in ('human','agent')),
                severity text not null check(severity in ('info','warn','block')),
                rationale text,
                signature text not null,
                created_at text not null,
                deleted_at text,
                check (
                    (scope = 'global' and task_id is null)
                    or (scope = 'task' and task_id is not null)
                )
            )
        `);
        await qr.query(`create index if not exists idx_rules_scope_active on rules(scope) where deleted_at is null`);
        await qr.query(`create index if not exists idx_rules_task_active on rules(task_id) where deleted_at is null`);
        await qr.query(`create index if not exists idx_rules_signature on rules(signature)`);
    }

    async down(qr: QueryRunner): Promise<void> {
        await qr.query(`drop table if exists rules`);
    }
}
