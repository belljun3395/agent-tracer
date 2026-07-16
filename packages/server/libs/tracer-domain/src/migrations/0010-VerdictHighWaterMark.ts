import type { MigrationInterface, QueryRunner } from "typeorm";

export class VerdictHighWaterMark1784170000000 implements MigrationInterface {
    name = "VerdictHighWaterMark1784170000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "verdicts" ADD "last_evaluated_seq" text`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "verdicts" DROP COLUMN "last_evaluated_seq"`);
    }
}
