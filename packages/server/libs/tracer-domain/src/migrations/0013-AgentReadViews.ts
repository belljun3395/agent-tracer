import type { MigrationInterface, QueryRunner } from "typeorm";

export class AgentReadViews1784437024608 implements MigrationInterface {
    name = 'AgentReadViews1784437024608'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE VIEW "agent_event_view" AS 
        SELECT
            e.id AS id,
            e.seq AS seq,
            e.user_id AS user_id,
            e.task_id AS task_id,
            e.turn_id AS turn_id,
            e.kind AS kind,
            e.title AS title,
            e.body AS body,
            e.tool_name AS tool_name,
            e.file_paths AS file_paths,
            e.metadata AS metadata,
            e.occurred_at AS occurred_at
        FROM events e
    `);
        await queryRunner.query(`INSERT INTO "typeorm_metadata"("database", "schema", "table", "type", "name", "value") VALUES (DEFAULT, $1, DEFAULT, $2, $3, $4)`, ["public","VIEW","agent_event_view","SELECT\n            e.id AS id,\n            e.seq AS seq,\n            e.user_id AS user_id,\n            e.task_id AS task_id,\n            e.turn_id AS turn_id,\n            e.kind AS kind,\n            e.title AS title,\n            e.body AS body,\n            e.tool_name AS tool_name,\n            e.file_paths AS file_paths,\n            e.metadata AS metadata,\n            e.occurred_at AS occurred_at\n        FROM events e"]);
        await queryRunner.query(`CREATE VIEW "agent_rule_view" AS 
        SELECT
            r.id AS id,
            r.user_id AS user_id,
            r.task_id AS task_id,
            r.name AS name,
            r.expectation AS expectation,
            r.anchor_event_id AS anchor_event_id,
            r.source AS source,
            r.severity AS severity,
            r.rationale AS rationale,
            r.signature AS signature,
            r.created_at AS created_at
        FROM rules r
        WHERE r.review_state = 'active' AND r.deleted_at IS NULL
    `);
        await queryRunner.query(`INSERT INTO "typeorm_metadata"("database", "schema", "table", "type", "name", "value") VALUES (DEFAULT, $1, DEFAULT, $2, $3, $4)`, ["public","VIEW","agent_rule_view","SELECT\n            r.id AS id,\n            r.user_id AS user_id,\n            r.task_id AS task_id,\n            r.name AS name,\n            r.expectation AS expectation,\n            r.anchor_event_id AS anchor_event_id,\n            r.source AS source,\n            r.severity AS severity,\n            r.rationale AS rationale,\n            r.signature AS signature,\n            r.created_at AS created_at\n        FROM rules r\n        WHERE r.review_state = 'active' AND r.deleted_at IS NULL"]);
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
            s.custom_title AS custom_title,
            s.archived_at AS archived_at,
            s.hidden_at AS hidden_at
        FROM tasks t
        LEFT JOIN task_user_state s ON s.task_id = t.id AND s.user_id = t.user_id
    `);
        await queryRunner.query(`INSERT INTO "typeorm_metadata"("database", "schema", "table", "type", "name", "value") VALUES (DEFAULT, $1, DEFAULT, $2, $3, $4)`, ["public","VIEW","agent_task_view","SELECT\n            t.id AS id,\n            t.user_id AS user_id,\n            t.title AS title,\n            t.status AS status,\n            t.task_kind AS task_kind,\n            t.origin AS origin,\n            t.workspace_path AS workspace_path,\n            t.parent_task_id AS parent_task_id,\n            t.created_at AS created_at,\n            t.updated_at AS updated_at,\n            t.last_event_at AS last_event_at,\n            s.custom_title AS custom_title,\n            s.archived_at AS archived_at,\n            s.hidden_at AS hidden_at\n        FROM tasks t\n        LEFT JOIN task_user_state s ON s.task_id = t.id AND s.user_id = t.user_id"]);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DELETE FROM "typeorm_metadata" WHERE "type" = $1 AND "name" = $2 AND "schema" = $3`, ["VIEW","agent_task_view","public"]);
        await queryRunner.query(`DROP VIEW "agent_task_view"`);
        await queryRunner.query(`DELETE FROM "typeorm_metadata" WHERE "type" = $1 AND "name" = $2 AND "schema" = $3`, ["VIEW","agent_rule_view","public"]);
        await queryRunner.query(`DROP VIEW "agent_rule_view"`);
        await queryRunner.query(`DELETE FROM "typeorm_metadata" WHERE "type" = $1 AND "name" = $2 AND "schema" = $3`, ["VIEW","agent_event_view","public"]);
        await queryRunner.query(`DROP VIEW "agent_event_view"`);
    }

}
