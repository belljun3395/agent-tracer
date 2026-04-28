import type { MigrationInterface, QueryRunner } from "typeorm";

export class CreateTurnPartitionSchema1700000006000 implements MigrationInterface {
    async up(qr: QueryRunner): Promise<void> {
        await qr.query(`
            create table if not exists turn_partitions_current (
                task_id text primary key references tasks_current(id) on delete cascade,
                groups_json text not null,
                version integer not null default 1,
                updated_at text not null
            )
        `);
    }

    async down(qr: QueryRunner): Promise<void> {
        await qr.query(`drop table if exists turn_partitions_current`);
    }
}
