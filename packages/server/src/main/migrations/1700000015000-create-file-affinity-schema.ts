import type { MigrationInterface, QueryRunner } from "typeorm";

export class CreateFileAffinitySchema1700000015000
    implements MigrationInterface
{
    async up(qr: QueryRunner): Promise<void> {
        await qr.query(`
            create table if not exists file_affinity_summary (
                file_path       text not null,
                intent_label    text not null,
                role            text not null check(role in ('read','write','both')),
                open_count      integer not null default 0,
                last_seen_at    text not null,
                primary key (file_path, intent_label, role)
            )
        `);
        await qr.query(
            `create index if not exists idx_file_affinity_intent on file_affinity_summary(intent_label, open_count desc)`,
        );
        await qr.query(
            `create index if not exists idx_file_affinity_path on file_affinity_summary(file_path)`,
        );
    }

    async down(qr: QueryRunner): Promise<void> {
        await qr.query(`drop table if exists file_affinity_summary`);
    }
}
