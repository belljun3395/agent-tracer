import type { MigrationInterface, QueryRunner } from "typeorm";

export class SettingsScope1784211758198 implements MigrationInterface {
    name = "SettingsScope1784211758198";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "app_settings" ADD "scope" text NOT NULL DEFAULT 'local'`);
        await queryRunner.query(`ALTER TABLE "app_settings" ALTER COLUMN "scope" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "app_settings" DROP CONSTRAINT "PK_975c2db59c65c05fd9c6b63a2ab"`);
        await queryRunner.query(`ALTER TABLE "app_settings" ADD CONSTRAINT "PK_5670cdf891495c8223e16ed02fe" PRIMARY KEY ("key", "scope")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "app_settings" DROP CONSTRAINT "PK_5670cdf891495c8223e16ed02fe"`);
        await queryRunner.query(`ALTER TABLE "app_settings" ADD CONSTRAINT "PK_975c2db59c65c05fd9c6b63a2ab" PRIMARY KEY ("key")`);
        await queryRunner.query(`ALTER TABLE "app_settings" DROP COLUMN "scope"`);
    }
}
