import type { MigrationInterface, QueryRunner } from "typeorm";

export class Tag1784472971884 implements MigrationInterface {
    name = 'Tag1784472971884'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "tags" ("id" text NOT NULL, "user_id" text NOT NULL, "name" text NOT NULL, "color" text NOT NULL, "description" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL, "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_e7dc17249a1148a1970748eda99" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "tags_live_user" ON "tags" ("user_id") WHERE "deleted_at" IS NULL`);
        await queryRunner.query(`CREATE UNIQUE INDEX "tags_user_name" ON "tags" ("user_id", "name") WHERE "deleted_at" IS NULL`);
        await queryRunner.query(`CREATE TABLE "task_tags" ("id" text NOT NULL, "user_id" text NOT NULL, "task_id" text NOT NULL, "tag_id" text NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_7b47a7628547c0976415988d3cb" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "task_tags_tag" ON "task_tags" ("user_id", "tag_id") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "task_tags_unique" ON "task_tags" ("user_id", "task_id", "tag_id") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."task_tags_unique"`);
        await queryRunner.query(`DROP INDEX "public"."task_tags_tag"`);
        await queryRunner.query(`DROP TABLE "task_tags"`);
        await queryRunner.query(`DROP INDEX "public"."tags_user_name"`);
        await queryRunner.query(`DROP INDEX "public"."tags_live_user"`);
        await queryRunner.query(`DROP TABLE "tags"`);
    }

}
