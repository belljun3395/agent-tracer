import type { MigrationInterface, QueryRunner } from "typeorm";

export class CreateTaskRuleGenerationJobsSchema1700000010000
    implements MigrationInterface
{
    async up(qr: QueryRunner): Promise<void> {
        await qr.query(`
            create table if not exists task_rule_generation_jobs (
                id              text primary key,
                task_id         text not null references tasks_current(id) on delete cascade,
                status          text not null check(status in ('pending','processing','completed','failed')),
                attempts        integer not null default 0,
                error           text,
                rules_created   integer not null default 0,
                model_used      text,
                duration_ms     integer,
                created_at      text not null,
                updated_at      text not null,
                started_at      text,
                completed_at    text
            )
        `);
        await qr.query(
            `create index if not exists idx_task_rule_gen_status on task_rule_generation_jobs(status, created_at)`,
        );
        await qr.query(
            `create index if not exists idx_task_rule_gen_task on task_rule_generation_jobs(task_id, created_at desc)`,
        );
    }

    async down(qr: QueryRunner): Promise<void> {
        await qr.query(`drop table if exists task_rule_generation_jobs`);
    }
}
