import type { MigrationInterface, QueryRunner } from "typeorm";

export class AddTasksArchivedAt1700000011000 implements MigrationInterface {
    async up(qr: QueryRunner): Promise<void> {
        await qr.query(`alter table tasks_current add column archived_at text`);
        await qr.query(
            `create index if not exists idx_tasks_current_archived on tasks_current(archived_at)`,
        );
    }

    async down(qr: QueryRunner): Promise<void> {
        await qr.query(`drop index if exists idx_tasks_current_archived`);
        await qr.query(`alter table tasks_current drop column archived_at`);
    }
}
