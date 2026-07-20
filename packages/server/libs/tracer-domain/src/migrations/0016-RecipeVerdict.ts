import type { MigrationInterface, QueryRunner } from "typeorm";

export class RecipeVerdict1784516563637 implements MigrationInterface {
    name = "RecipeVerdict1784516563637";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "recipe_applications" ADD "anchor_event_id" text`);
        await queryRunner.query(`ALTER TABLE "recipe_applications" ADD "anchor_seq" bigint`);
        await queryRunner.query(`ALTER TABLE "recipe_applications" ADD "verdict" text`);
        await queryRunner.query(`ALTER TABLE "recipe_applications" ADD "verdict_evidence" jsonb`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "recipe_applications" DROP COLUMN "verdict_evidence"`);
        await queryRunner.query(`ALTER TABLE "recipe_applications" DROP COLUMN "verdict"`);
        await queryRunner.query(`ALTER TABLE "recipe_applications" DROP COLUMN "anchor_seq"`);
        await queryRunner.query(`ALTER TABLE "recipe_applications" DROP COLUMN "anchor_event_id"`);
    }
}
