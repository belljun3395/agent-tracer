import type { MigrationInterface, QueryRunner } from "typeorm";

export class CreateSessionSchema1700000002000 implements MigrationInterface {
    async up(qr: QueryRunner): Promise<void> {
        await qr.query(`
            create table if not exists sessions_current (
                id text primary key,
                task_id text not null,
                status text not null,
                summary text,
                started_at text not null,
                ended_at text
            )
        `);
        await qr.query(`
            create index if not exists idx_sessions_current_task_started
                on sessions_current(task_id, started_at)
        `);
        await qr.query(`
            create index if not exists idx_sessions_current_task_status_started
                on sessions_current(task_id, status, started_at desc)
        `);
        await qr.query(`
            create table if not exists runtime_bindings_current (
                runtime_source text not null,
                runtime_session_id text not null,
                task_id text not null references tasks_current(id) on delete cascade,
                monitor_session_id text references sessions_current(id) on delete set null,
                created_at text not null,
                updated_at text not null,
                primary key (runtime_source, runtime_session_id)
            )
        `);
    }

    async down(qr: QueryRunner): Promise<void> {
        await qr.query(`drop table if exists runtime_bindings_current`);
        await qr.query(`drop table if exists sessions_current`);
    }
}
