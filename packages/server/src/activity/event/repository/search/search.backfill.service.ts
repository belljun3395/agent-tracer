import { Injectable, type OnApplicationBootstrap } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource } from "typeorm";
import { backfillSearchDocuments } from "./search.documents.js";

/**
 * Runs the search-document backfill once after TypeORM has connected and
 * schemas exist. Replaces the previous bootstrap-time invocation that ran
 * against a raw better-sqlite3 client before the ORM was ready.
 */
@Injectable()
export class SearchBackfillService implements OnApplicationBootstrap {
    constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

    async onApplicationBootstrap(): Promise<void> {
        await backfillSearchDocuments(this.dataSource.manager);
    }
}
