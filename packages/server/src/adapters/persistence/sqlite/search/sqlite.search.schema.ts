import type Database from "better-sqlite3";

export function createSearchSchema(db: Database.Database): void {
    db.exec(`
      create table if not exists search_documents (
        scope text not null check(scope in ('task', 'event')),
        entity_id text not null,
        task_id text,
        search_text text not null,
        embedding text,
        embedding_model text,
        updated_at text not null,
        primary key (scope, entity_id)
      );

      create index if not exists idx_search_documents_scope_task_updated
        on search_documents(scope, task_id, updated_at desc);
    `);
}
