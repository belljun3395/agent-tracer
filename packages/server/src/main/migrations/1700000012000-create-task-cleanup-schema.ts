import type { MigrationInterface, QueryRunner } from "typeorm";

export class CreateTaskCleanupSchema1700000012000 implements MigrationInterface {
    async up(qr: QueryRunner): Promise<void> {
        await qr.query(`
            create table if not exists task_cleanup_jobs (
                id                   text primary key,
                status               text not null check(status in ('pending','processing','completed','failed')),
                attempts             integer not null default 0,
                error                text,
                suggestions_created  integer not null default 0,
                tasks_scanned        integer not null default 0,
                model_used           text,
                duration_ms          integer,
                created_at           text not null,
                updated_at           text not null,
                started_at           text,
                completed_at         text
            )
        `);
        await qr.query(
            `create index if not exists idx_task_cleanup_jobs_status on task_cleanup_jobs(status, created_at)`,
        );
        await qr.query(`
            create table if not exists task_cleanup_suggestions (
                id              text primary key,
                job_id          text not null references task_cleanup_jobs(id) on delete cascade,
                task_id         text not null references tasks_current(id) on delete cascade,
                kind            text not null check(kind in ('archive','rename_title','set_parent','reslug')),
                current_value   text,
                proposed_value  text,
                rationale       text not null,
                status          text not null check(status in ('pending','accepted','dismissed','failed')),
                error           text,
                created_at      text not null,
                resolved_at     text
            )
        `);
        await qr.query(
            `create index if not exists idx_task_cleanup_sugg_status on task_cleanup_suggestions(status, created_at desc)`,
        );
        await qr.query(
            `create index if not exists idx_task_cleanup_sugg_job on task_cleanup_suggestions(job_id)`,
        );
        await qr.query(
            `create index if not exists idx_task_cleanup_sugg_task on task_cleanup_suggestions(task_id)`,
        );
    }

    async down(qr: QueryRunner): Promise<void> {
        await qr.query(`drop table if exists task_cleanup_suggestions`);
        await qr.query(`drop table if exists task_cleanup_jobs`);
    }
}
