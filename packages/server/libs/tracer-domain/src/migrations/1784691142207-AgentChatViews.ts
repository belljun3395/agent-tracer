import type { MigrationInterface, QueryRunner } from "typeorm";

export class AgentChatViews1784691142207 implements MigrationInterface {
    name = 'AgentChatViews1784691142207'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE VIEW "agent_chat_thread_view" AS SELECT id, user_id, summary FROM chat_threads`);
        await queryRunner.query(`INSERT INTO "typeorm_metadata"("database", "schema", "table", "type", "name", "value") VALUES (DEFAULT, $1, DEFAULT, $2, $3, $4)`, ["public","VIEW","agent_chat_thread_view","SELECT id, user_id, summary FROM chat_threads"]);
        await queryRunner.query(`CREATE VIEW "agent_chat_execution_view" AS SELECT id, user_id, thread_id, user_message_id, assistant_message_id, status, created_at FROM chat_executions`);
        await queryRunner.query(`INSERT INTO "typeorm_metadata"("database", "schema", "table", "type", "name", "value") VALUES (DEFAULT, $1, DEFAULT, $2, $3, $4)`, ["public","VIEW","agent_chat_execution_view","SELECT id, user_id, thread_id, user_message_id, assistant_message_id, status, created_at FROM chat_executions"]);
        await queryRunner.query(`CREATE VIEW "agent_chat_message_view" AS SELECT id, thread_id, role, content, tool_calls, tool_call_id FROM chat_messages`);
        await queryRunner.query(`INSERT INTO "typeorm_metadata"("database", "schema", "table", "type", "name", "value") VALUES (DEFAULT, $1, DEFAULT, $2, $3, $4)`, ["public","VIEW","agent_chat_message_view","SELECT id, thread_id, role, content, tool_calls, tool_call_id FROM chat_messages"]);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DELETE FROM "typeorm_metadata" WHERE "type" = $1 AND "name" = $2 AND "schema" = $3`, ["VIEW","agent_chat_message_view","public"]);
        await queryRunner.query(`DROP VIEW "agent_chat_message_view"`);
        await queryRunner.query(`DELETE FROM "typeorm_metadata" WHERE "type" = $1 AND "name" = $2 AND "schema" = $3`, ["VIEW","agent_chat_execution_view","public"]);
        await queryRunner.query(`DROP VIEW "agent_chat_execution_view"`);
        await queryRunner.query(`DELETE FROM "typeorm_metadata" WHERE "type" = $1 AND "name" = $2 AND "schema" = $3`, ["VIEW","agent_chat_thread_view","public"]);
        await queryRunner.query(`DROP VIEW "agent_chat_thread_view"`);
    }

}
