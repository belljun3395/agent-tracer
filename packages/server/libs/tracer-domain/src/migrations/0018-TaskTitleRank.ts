import type { MigrationInterface, QueryRunner } from "typeorm";

export class TaskTitleRank1784538084713 implements MigrationInterface {
    name = "TaskTitleRank1784538084713";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DELETE FROM "typeorm_metadata" WHERE "type" = $1 AND "name" = $2 AND "schema" = $3`, ["VIEW","agent_task_view","public"]);
        await queryRunner.query(`DROP VIEW "agent_task_view"`);
        await queryRunner.query(`ALTER TABLE "task_user_state" DROP COLUMN "custom_title"`);
        await queryRunner.query(`ALTER TABLE "tasks" ADD "title_rank" text NOT NULL DEFAULT 'auto'`);
        await queryRunner.query(`CREATE VIEW "agent_task_view" AS
        SELECT
            t.id AS id,
            t.user_id AS user_id,
            t.title AS title,
            t.status AS status,
            t.task_kind AS task_kind,
            t.origin AS origin,
            t.workspace_path AS workspace_path,
            t.parent_task_id AS parent_task_id,
            t.created_at AS created_at,
            t.updated_at AS updated_at,
            t.last_event_at AS last_event_at,
            s.archived_at AS archived_at,
            s.hidden_at AS hidden_at
        FROM tasks t
        LEFT JOIN task_user_state s ON s.task_id = t.id AND s.user_id = t.user_id
    `);
        await queryRunner.query(`INSERT INTO "typeorm_metadata"("database", "schema", "table", "type", "name", "value") VALUES (DEFAULT, $1, DEFAULT, $2, $3, $4)`, ["public","VIEW","agent_task_view","SELECT\n            t.id AS id,\n            t.user_id AS user_id,\n            t.title AS title,\n            t.status AS status,\n            t.task_kind AS task_kind,\n            t.origin AS origin,\n            t.workspace_path AS workspace_path,\n            t.parent_task_id AS parent_task_id,\n            t.created_at AS created_at,\n            t.updated_at AS updated_at,\n            t.last_event_at AS last_event_at,\n            s.archived_at AS archived_at,\n            s.hidden_at AS hidden_at\n        FROM tasks t\n        LEFT JOIN task_user_state s ON s.task_id = t.id AND s.user_id = t.user_id"]);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DELETE FROM "typeorm_metadata" WHERE "type" = $1 AND "name" = $2 AND "schema" = $3`, ["VIEW","agent_task_view","public"]);
        await queryRunner.query(`DROP VIEW "agent_task_view"`);
        await queryRunner.query(`ALTER TABLE "tasks" DROP COLUMN "title_rank"`);
        await queryRunner.query(`ALTER TABLE "task_user_state" ADD "custom_title" text`);
        await queryRunner.query(`CREATE VIEW "agent_task_view" AS SELECT
            t.id AS id,
            t.user_id AS user_id,
            t.title AS title,
            t.status AS status,
            t.task_kind AS task_kind,
            t.origin AS origin,
            t.workspace_path AS workspace_path,
            t.parent_task_id AS parent_task_id,
            t.created_at AS created_at,
            t.updated_at AS updated_at,
            t.last_event_at AS last_event_at,
            s.custom_title AS custom_title,
            s.archived_at AS archived_at,
            s.hidden_at AS hidden_at
        FROM tasks t
        LEFT JOIN task_user_state s ON s.task_id = t.id AND s.user_id = t.user_id`);
        await queryRunner.query(`INSERT INTO "typeorm_metadata"("database", "schema", "table", "type", "name", "value") VALUES (DEFAULT, $1, DEFAULT, $2, $3, $4)`, ["public","VIEW","agent_task_view","SELECT\n            t.id AS id,\n            t.user_id AS user_id,\n            t.title AS title,\n            t.status AS status,\n            t.task_kind AS task_kind,\n            t.origin AS origin,\n            t.workspace_path AS workspace_path,\n            t.parent_task_id AS parent_task_id,\n            t.created_at AS created_at,\n            t.updated_at AS updated_at,\n            t.last_event_at AS last_event_at,\n            s.custom_title AS custom_title,\n            s.archived_at AS archived_at,\n            s.hidden_at AS hidden_at\n        FROM tasks t\n        LEFT JOIN task_user_state s ON s.task_id = t.id AND s.user_id = t.user_id"]);
    }
}
