import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Replace JS-side lexical scoring with native SQLite FTS5 ranking.
 *
 * Architecture:
 *   - `search_documents` keeps its existing shape and stays the source of
 *     truth (PK, embedding column, etc).
 *   - `search_documents_fts` is an external-content FTS5 virtual table whose
 *     content lives in `search_documents.search_text`. It stores only the
 *     inverted index — no row duplication.
 *   - AFTER INSERT/UPDATE/DELETE triggers keep the FTS index in sync.
 *
 * After this migration the search endpoint MATCHes the FTS index instead of
 * loading every document into JS for substring scoring. With 7943 documents
 * the old code allocated ~2.8 MB per query; FTS5 reuses its on-disk index.
 */
export class CreateSearchFts51700000008000 implements MigrationInterface {
    async up(qr: QueryRunner): Promise<void> {
        await qr.query(`
            create virtual table if not exists search_documents_fts using fts5(
                search_text,
                content='search_documents',
                content_rowid='rowid',
                tokenize='unicode61 remove_diacritics 1'
            )
        `);

        await qr.query(`
            insert into search_documents_fts(rowid, search_text)
            select rowid, search_text from search_documents
            where not exists (
                select 1 from search_documents_fts f where f.rowid = search_documents.rowid
            )
        `);

        await qr.query(`
            create trigger if not exists trg_search_documents_ai
            after insert on search_documents begin
                insert into search_documents_fts(rowid, search_text) values (new.rowid, new.search_text);
            end
        `);

        await qr.query(`
            create trigger if not exists trg_search_documents_ad
            after delete on search_documents begin
                insert into search_documents_fts(search_documents_fts, rowid, search_text)
                values('delete', old.rowid, old.search_text);
            end
        `);

        await qr.query(`
            create trigger if not exists trg_search_documents_au
            after update on search_documents begin
                insert into search_documents_fts(search_documents_fts, rowid, search_text)
                values('delete', old.rowid, old.search_text);
                insert into search_documents_fts(rowid, search_text)
                values(new.rowid, new.search_text);
            end
        `);
    }

    async down(qr: QueryRunner): Promise<void> {
        await qr.query(`drop trigger if exists trg_search_documents_au`);
        await qr.query(`drop trigger if exists trg_search_documents_ad`);
        await qr.query(`drop trigger if exists trg_search_documents_ai`);
        await qr.query(`drop table if exists search_documents_fts`);
    }
}
