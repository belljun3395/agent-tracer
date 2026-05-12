import type { MigrationInterface, QueryRunner } from "typeorm";

export class CreateAppSettingsSchema1700000009000 implements MigrationInterface {
    async up(qr: QueryRunner): Promise<void> {
        await qr.query(`
            create table if not exists app_settings (
                key         text primary key,
                value       text not null,
                updated_at  text not null
            )
        `);
    }

    async down(qr: QueryRunner): Promise<void> {
        await qr.query(`drop table if exists app_settings`);
    }
}
