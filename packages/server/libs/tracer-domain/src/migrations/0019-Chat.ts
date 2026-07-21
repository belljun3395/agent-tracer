import type { MigrationInterface, QueryRunner } from "typeorm";

export class Chat1784665076620 implements MigrationInterface {
    name = "Chat1784665076620";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `CREATE TABLE "chat_messages" ("id" text NOT NULL, "thread_id" text NOT NULL, "role" text NOT NULL, "content" text NOT NULL, "tool_calls" jsonb, "tool_call_id" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_40c55ee0e571e268b0d3cd37d10" PRIMARY KEY ("id"))`,
        );
        await queryRunner.query(
            `CREATE INDEX "chat_messages_thread_created" ON "chat_messages" ("thread_id", "created_at") `,
        );
        await queryRunner.query(
            `CREATE TABLE "chat_pending_tools" ("id" text NOT NULL, "thread_id" text NOT NULL, "message_id" text, "tool_name" text NOT NULL, "args" jsonb NOT NULL DEFAULT '{}', "status" text NOT NULL DEFAULT 'pending', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL, "resolved_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_1ffda91ba79f9ad28c4149102b9" PRIMARY KEY ("id"))`,
        );
        await queryRunner.query(
            `CREATE INDEX "chat_pending_tools_thread_status" ON "chat_pending_tools" ("thread_id", "status") `,
        );
        await queryRunner.query(
            `CREATE TABLE "chat_threads" ("id" text NOT NULL, "user_id" text NOT NULL, "title" text NOT NULL, "summary" text, "backend" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_973a81c0adb9b18a5ea3ef95bf8" PRIMARY KEY ("id"))`,
        );
        await queryRunner.query(
            `CREATE INDEX "chat_threads_user_updated" ON "chat_threads" ("user_id", "updated_at") `,
        );
        await queryRunner.query(
            `CREATE TABLE "chat_user_memories" ("id" text NOT NULL, "user_id" text NOT NULL, "key" text NOT NULL, "content" text NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_e425b98d2451d7fa5324964562c" PRIMARY KEY ("id"))`,
        );
        await queryRunner.query(
            `CREATE UNIQUE INDEX "chat_user_memories_unique" ON "chat_user_memories" ("user_id", "key") `,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."chat_user_memories_unique"`);
        await queryRunner.query(`DROP TABLE "chat_user_memories"`);
        await queryRunner.query(`DROP INDEX "public"."chat_threads_user_updated"`);
        await queryRunner.query(`DROP TABLE "chat_threads"`);
        await queryRunner.query(`DROP INDEX "public"."chat_pending_tools_thread_status"`);
        await queryRunner.query(`DROP TABLE "chat_pending_tools"`);
        await queryRunner.query(`DROP INDEX "public"."chat_messages_thread_created"`);
        await queryRunner.query(`DROP TABLE "chat_messages"`);
    }
}
