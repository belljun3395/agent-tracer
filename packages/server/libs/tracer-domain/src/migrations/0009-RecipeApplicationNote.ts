import type { MigrationInterface, QueryRunner } from "typeorm";

export class RecipeApplicationNote1784160000000 implements MigrationInterface {
    name = "RecipeApplicationNote1784160000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "recipe_applications" ADD "note" text`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "recipe_applications" DROP COLUMN "note"`);
    }
}
