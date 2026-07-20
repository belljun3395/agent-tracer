import type { MigrationInterface, QueryRunner } from "typeorm";

/** 레시피 적용의 원장 관측 판정을 걷어내 자기보고만 남기므로 verdict 관련 열을 뺀다. */
export class RemoveRecipeVerdict1784535700023 implements MigrationInterface {
    name = "RemoveRecipeVerdict1784535700023";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "recipe_applications" DROP COLUMN "resolved_at"`);
        await queryRunner.query(`ALTER TABLE "recipe_applications" DROP COLUMN "verdict_evidence"`);
        await queryRunner.query(`ALTER TABLE "recipe_applications" DROP COLUMN "verdict"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "recipe_applications" ADD "verdict" text`);
        await queryRunner.query(`ALTER TABLE "recipe_applications" ADD "verdict_evidence" jsonb`);
        await queryRunner.query(`ALTER TABLE "recipe_applications" ADD "resolved_at" TIMESTAMP WITH TIME ZONE`);
    }
}
