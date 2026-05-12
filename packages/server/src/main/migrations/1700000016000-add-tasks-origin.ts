import type { MigrationInterface, QueryRunner } from "typeorm";

export class AddTasksOrigin1700000016000 implements MigrationInterface {
    async up(qr: QueryRunner): Promise<void> {
        await qr.query(
            `alter table tasks_current add column origin text not null default 'user'`,
        );
        await qr.query(
            `create index if not exists idx_tasks_current_origin on tasks_current(origin)`,
        );
    }

    async down(qr: QueryRunner): Promise<void> {
        await qr.query(`drop index if exists idx_tasks_current_origin`);
        await qr.query(`alter table tasks_current drop column origin`);
    }
}
