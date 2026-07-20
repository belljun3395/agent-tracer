import type { MigrationInterface, QueryRunner } from "typeorm";

/** 매칭이 사라져 점수가 없으므로 레시피 적용 이력에서 score 열을 뺀다. */
export class RemoveRecipeApplicationScore1784513440481 implements MigrationInterface {
    name = "RemoveRecipeApplicationScore1784513440481";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "recipe_applications" DROP COLUMN "score"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "recipe_applications" ADD "score" real`);
    }
}
